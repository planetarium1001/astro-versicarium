#!/usr/bin/env python3
"""fontTools 构建助手：可变字体实例化 + 按目标字节切分 + WOFF2 输出。

调用方：scripts/font-subset.mjs
  /tmp/dsh-fontenv/bin/python scripts/font/font_ops.py --plan plan.json --out result.json

职责边界：
- Node 端（plan.mjs）决定「哪些字、按什么顺序、目标多少字节、写到哪」；
- 本脚本负责实测字节、拟合 core、切分 mid/meta/display/DLC、输出 WOFF2 与每块的精确 cmap；
- 精确 cmap 回传后由 Node 生成 unicode-range / manifest，保证声明范围 == 实际覆盖。

stdout/stderr：进度写 stderr；结果写 --out 指定的 JSON 文件。
"""

import argparse
import hashlib
import io
import json
import math
import os
import sys
import time

from fontTools import subset
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont

try:
    import brotli  # noqa: F401  # WOFF2 压缩依赖
except ImportError:  # pragma: no cover - 环境缺失时给出明确错误
    sys.stderr.write("[font_ops] 缺少 brotli：请安装 fonttools[woff] 或 pip install brotli\n")
    raise

START_TIME = time.time()


def log(message):
    sys.stderr.write(f"[font_ops] {message}\n")
    sys.stderr.flush()


def hash_bytes(data):
    return hashlib.sha256(data).hexdigest()


def ranges_from_sorted(codepoints):
    ranges = []
    for codepoint in codepoints:
        if ranges and codepoint == ranges[-1][1] + 1:
            ranges[-1][1] = codepoint
        else:
            ranges.append([codepoint, codepoint])
    return ranges


def cmap_ranges(cmap_keys):
    return ranges_from_sorted(sorted(cmap_keys))


def in_ranges(codepoint, ranges):
    for start, end in ranges:
        if start <= codepoint <= end:
            return True
        if codepoint < start:
            return False
    return False


class SourceFont:
    """一个 family/weight 的源字体（必要时实例化并缓存为静态 TTF）。"""

    def __init__(self, plan_source, cache_dir, zopfli=False):
        self.key = plan_source["key"]
        self.path = os.path.abspath(plan_source["path"])
        self.axes = plan_source.get("axes") or None
        self.zopfli = zopfli
        self.cache_hit = False
        if not os.path.exists(self.path):
            raise SystemExit(
                f"[font_ops] 缺少源字体 {self.path}；先运行 npm run font:fetch 或放入 tools/fonts-src/"
            )
        self.font_path = self._resolve_instance_path(cache_dir)
        self.font_bytes = self._read_bytes(self.font_path)
        self.base_font = subset.load_font(io.BytesIO(self.font_bytes), self._options())
        self.cmap = set(self.base_font.getBestCmap().keys())
        self.glyph_count = len(self.base_font.getGlyphOrder())
        log(
            f"source {self.key}: glyphs={self.glyph_count} cmap={len(self.cmap)} "
            f"cache={'hit' if self.cache_hit else 'miss'} path={os.path.relpath(self.font_path)}"
        )

    def _options(self):
        options = subset.Options()
        options.flavor = "woff2"
        options.with_zopfli = False  # zopfli 只对 woff(1) 生效；woff2 用 brotli
        options.drop_tables += ["DSIG"]
        # 保留版权、许可证与来源元数据（nameID 0/7/8/9/10/13/14），
        # 避免子集化后只剩 family 名而丢失 OFL 要求的版权与许可信息。
        options.name_IDs = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14]
        options.name_legacy = True
        options.name_languages = ["*"]
        return options

    @staticmethod
    def _read_bytes(path):
        with open(path, "rb") as handle:
            return handle.read()

    def _resolve_instance_path(self, cache_dir):
        if not self.axes:
            return self.path
        stat = os.stat(self.path)
        axes_key = ",".join(f"{name}={value}" for name, value in sorted(self.axes.items()))
        fingerprint = hash_bytes(
            f"{self.path}|{stat.st_size}|{stat.st_mtime_ns}|{axes_key}".encode("utf-8")
        )[:16]
        os.makedirs(cache_dir, exist_ok=True)
        cache_path = os.path.join(cache_dir, f"{safe_name(self.key)}-{fingerprint}.ttf")
        if os.path.exists(cache_path):
            self.cache_hit = True
            return cache_path
        log(f"instancing {self.key} axes={self.axes} (可能较慢，结果会缓存)")
        font = TTFont(self.path, lazy=False)
        if "fvar" not in font:
            log(f"警告：{self.key} 源文件没有 fvar，忽略 axes={self.axes} 使用原文件")
            return self.path
        available = {axis.axisTag for axis in font["fvar"].axes}
        missing = set(self.axes) - available
        if missing:
            raise SystemExit(f"[font_ops] {self.key} 缺少可变轴 {sorted(missing)}，可用的轴：{sorted(available)}")
        instance = instantiateVariableFont(font, self.axes, inplace=False)
        instance.save(cache_path)
        log(f"instanced -> {os.path.relpath(cache_path)}")
        return cache_path

    def subset(self, codepoints):
        """返回 (woff2 bytes, 实际 cmap code points)。"""
        requested = sorted({int(cp) for cp in codepoints})
        font = subset.load_font(io.BytesIO(self.font_bytes), self._options(), lazy=True)
        subsetter = subset.Subsetter(options=self._options())
        subsetter.populate(unicodes=requested)
        subsetter.subset(font)
        present_name_ids = {record.nameID for record in font["name"].names}
        missing_license_ids = {0, 13, 14} - present_name_ids
        if missing_license_ids:
            raise SystemExit(
                f"[font_ops] {self.key} 子集缺少版权/许可 name 记录 {sorted(missing_license_ids)}"
            )
        buffer = io.BytesIO()
        subset.save_font(font, buffer, self._options())
        data = buffer.getvalue()
        actual = set(font.getBestCmap().keys())
        actual &= set(requested)
        return data, actual


def safe_name(value):
    return "".join(ch if ch.isalnum() or ch in "-_." else "-" for ch in value)


def even_split(items, count):
    if count <= 1:
        return [items]
    size = math.ceil(len(items) / count)
    return [items[index : index + size] for index in range(0, len(items), size)]


class Builder:
    def __init__(self, plan):
        self.plan = plan
        self.zopfli = bool(plan.get("zopfli"))
        cache_dir = os.path.abspath(plan.get("cacheDir") or "tools/fonts-src/.cache")
        self.sources = {
            entry["key"]: SourceFont(entry, cache_dir, self.zopfli) for entry in plan.get("sources", [])
        }
        self.cjk_ranges = plan.get("cjkRanges") or []
        self.base_covered = {}  # sourceKey -> set(codepoints)

    # ---- 输出 ----
    def write_chunk(self, out_dir, name_prefix, tier, index, data, codepoints):
        full_digest = hash_bytes(data)
        digest = full_digest[:8]
        # namePrefix 已含 role（text/meta/display/latin/dlc）时不再重复 tier 段：
        # noto-serif-sc-400-meta + meta -> noto-serif-sc-400-meta-01.<hash>.woff2
        prefix = name_prefix if name_prefix.endswith(f"-{tier}") else f"{name_prefix}-{tier}"
        name = f"{prefix}-{index:02d}.{digest}.woff2"
        os.makedirs(out_dir, exist_ok=True)
        path = os.path.join(out_dir, name)
        with open(path, "wb") as handle:
            handle.write(data)
        return {
            "name": name,
            "path": os.path.relpath(path),
            "bytes": len(data),
            "sha256": full_digest,
            "hash8": digest,
            "cmapCount": len(codepoints),
            "ranges": cmap_ranges(codepoints),
        }

    def record_covered(self, source_key, codepoints):
        covered = self.base_covered.setdefault(source_key, set())
        covered.update(codepoints)

    # ---- 单个 partition ----
    def measure(self, source, codepoints):
        data, actual = source.subset(codepoints)
        return data, actual

    def fit_single(self, source, chars, partition):
        target = int(partition.get("targetBytes") or partition.get("maxBytes") or 175_000)
        minimum = int(partition.get("minBytes") or 0)
        maximum = int(partition.get("maxBytes") or target)
        remaining = list(chars)
        chosen = remaining
        data, actual = self.measure(source, chosen)
        for _ in range(4):
            size = len(data)
            if size == 0:
                break
            if size > maximum:
                count = max(1, int(len(chosen) * target / size))
                count = min(count, len(chosen) - 1) if len(chosen) > 1 else len(chosen)
            elif size < minimum and len(chosen) < len(remaining):
                # 需要更大 prefix：按比例扩，但不能超过剩余字符
                count = min(len(remaining), int(len(chosen) * target / size) + 1)
            else:
                break
            if count <= 0 or count == len(chosen):
                break
            chosen = remaining[:count]
            data, actual = self.measure(source, chosen)
        leftover = remaining[len(chosen) :]
        return chosen, leftover, data, actual

    def split_partition(self, source, chars, target, tier):
        chars = list(chars)
        if not chars:
            return []
        target = max(1, int(target))
        total_data, total_actual = self.measure(source, chars)
        total_bytes = len(total_data)
        expected_chunks = max(1, min(len(chars), round(total_bytes / target)))
        results = None
        for _ in range(3):
            candidate = even_split(chars, expected_chunks)
            measured = [self.measure(source, chunk) for chunk in candidate]
            results = list(zip(candidate, measured))
            if expected_chunks == 1 or expected_chunks >= len(chars):
                break
            largest = max(len(data) for data, _ in measured)
            if largest <= target * 1.35:
                break
            expected_chunks = min(len(chars), expected_chunks + max(1, int(expected_chunks * (largest / target - 1))))
        if expected_chunks == 1:
            results = [(chars, (total_data, total_actual))]
        return results

    def build_series(self, series):
        source = self.sources[series["source"]]
        requested = list(dict.fromkeys(int(cp) for cp in series.get("chars") or []))
        available = [cp for cp in requested if cp in source.cmap]
        uncovered = [cp for cp in requested if cp not in source.cmap]
        remaining = available
        partitions_out = []
        for partition in series.get("partitions") or []:
            mode = partition.get("mode")
            tier = partition["tier"]
            if mode == "single-fit":
                chosen, remaining, data, actual = self.fit_single(source, remaining, partition)
            else:
                chunks_input = remaining
                remaining = []
                results = self.split_partition(source, chunks_input, partition.get("targetBytes"), tier)
                rendered = []
                index = 1
                for chunk_chars, (data, actual) in results:
                    rendered.append(
                        self.write_chunk(series["outDir"], series["namePrefix"], tier, index, data, actual)
                    )
                    index += 1
                partitions_out.append(
                    {
                        "tier": tier,
                        "mode": mode,
                        "targetBytes": partition.get("targetBytes"),
                        "charsCount": sum(len(chunk) for chunk, _ in results),
                        "chunks": rendered,
                    }
                )
                for _, (_, actual) in results:
                    self.record_covered(series["source"], actual)
                continue

            chunk = self.write_chunk(series["outDir"], series["namePrefix"], tier, 1, data, actual)
            self.record_covered(series["source"], actual)
            partitions_out.append(
                {
                    "tier": tier,
                    "mode": mode,
                    "targetBytes": partition.get("targetBytes"),
                    "minBytes": partition.get("minBytes"),
                    "maxBytes": partition.get("maxBytes"),
                    "charsCount": len(chosen),
                    "leftoverCount": len(remaining),
                    "chunks": [chunk],
                }
            )
            if not remaining:
                break
        return {
            "key": series["key"],
            "requestedCount": len(requested),
            "coveredCount": len(requested) - len(uncovered),
            "uncovered": uncovered,
            "uncoveredCount": len(uncovered),
            "partitions": partitions_out,
        }

    # ---- latin / dlc ----
    def build_latin(self, group):
        source = self.sources[group["source"]]
        ranges = group.get("ranges") or []
        if group.get("chars"):
            requested = {int(cp) for cp in group["chars"]}
            codepoints = sorted(cp for cp in requested if cp in source.cmap)
        else:
            codepoints = sorted(cp for cp in source.cmap if in_ranges(cp, ranges))
        data, actual = self.measure(source, codepoints)
        chunk = self.write_chunk(group["outDir"], group["namePrefix"], group.get("tier", "latin"), 1, data, actual)
        self.record_covered(group["source"], actual)
        return {"key": group["key"], "chunks": [chunk], "coveredCount": len(actual)}

    def build_dlc(self, group):
        source = self.sources[group["source"]]
        ranges = group.get("cjkRanges") or self.cjk_ranges
        source_cjk = {cp for cp in source.cmap if in_ranges(cp, ranges)}
        covered = self.base_covered.get(group["source"], set())
        base_covered_cjk = source_cjk & covered
        dlc_chars = sorted(source_cjk - base_covered_cjk)
        target = int(group.get("targetBytes") or 200_000)
        rendered = []
        if dlc_chars:
            results = self.split_partition(source, dlc_chars, target, "dlc")
            index = 1
            for chunk_chars, (data, actual) in results:
                rendered.append(
                    self.write_chunk(group["outDir"], group["namePrefix"], "dlc", index, data, actual)
                )
                index += 1
            # 记录实际 DLC 覆盖，便于统计 uncovered（理论上等于 dlc_chars）
            dlc_actual = set()
            for _, (_, actual) in results:
                dlc_actual |= actual
        else:
            dlc_actual = set()
        dlc_covered_cjk = dlc_actual & source_cjk
        uncovered = source_cjk - base_covered_cjk - dlc_covered_cjk
        return {
            "key": group["key"],
            "sourceCmapCjkCount": len(source_cjk),
            "baseCoveredCjkCount": len(base_covered_cjk),
            "dlcCoveredCjkCount": len(dlc_covered_cjk),
            "uncoveredCount": len(uncovered),
            "uncovered": sorted(uncovered),
            "chunks": rendered,
        }


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--plan", required=True)
    parser.add_argument("--out", required=True)
    args = parser.parse_args()

    with open(args.plan, encoding="utf-8") as handle:
        plan = json.load(handle)

    builder = Builder(plan)
    result = {
        "sources": {
            key: {
                "key": key,
                "path": os.path.relpath(source.font_path),
                "axes": source.axes,
                "glyphCount": source.glyph_count,
                "cmapCount": len(source.cmap),
                "cjkCount": len(
                    [cp for cp in source.cmap if in_ranges(cp, builder.cjk_ranges)]
                ),
                "cmapRanges": cmap_ranges(source.cmap),
                "cjkRanges": cmap_ranges(
                    [cp for cp in source.cmap if in_ranges(cp, builder.cjk_ranges)]
                ),
                "cacheHit": source.cache_hit,
            }
            for key, source in builder.sources.items()
        },
        "series": [],
        "latin": [],
        "dlc": [],
    }

    log(f"plan: sources={len(plan.get('sources', []))} series={len(plan.get('series', []))} "
        f"latin={len(plan.get('latin', []))} dlc={len(plan.get('dlc', []))}")

    for series in plan.get("series", []):
        log(f"series {series['key']} chars={len(series.get('chars') or [])}")
        result["series"].append(builder.build_series(series))
    for group in plan.get("latin", []):
        log(f"latin {group['key']}")
        result["latin"].append(builder.build_latin(group))
    for group in plan.get("dlc", []):
        log(f"dlc {group['key']}")
        result["dlc"].append(builder.build_dlc(group))

    os.makedirs(os.path.dirname(os.path.abspath(args.out)), exist_ok=True)
    with open(args.out, "w", encoding="utf-8") as handle:
        json.dump(result, handle, ensure_ascii=False)

    elapsed = time.time() - START_TIME
    total_faces = sum(
        len(partition.get("chunks") or [])
        for series in result["series"]
        for partition in series.get("partitions") or []
    ) + sum(len(g["chunks"]) for g in result["latin"]) + sum(len(g["chunks"]) for g in result["dlc"])
    log(f"done: faces={total_faces} elapsed={elapsed:.1f}s -> {args.out}")


if __name__ == "__main__":
    main()
