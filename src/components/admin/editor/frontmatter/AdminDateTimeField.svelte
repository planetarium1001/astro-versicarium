<script lang="ts">
import {
  composeDateTimeText,
  describeInstant,
  getDateTimeInputErrorMessage,
  splitDateTimeText
} from '../../../../lib/admin-console/datetime-field';
import { getSiteDateTimeParts } from '../../../../utils/date-only';
import { getSiteTimezone } from '../../../../utils/site-timezone';

/**
 * 后台日期时间字段：日期 + 时间双原生控件，时区固定站点时区并显式标注。
 *
 * 为什么保留「精确编辑」：历史内容里有 `2026-11-09T03:44:53Z` 这类机器写法，
 * 直接把原文塞进 date/time 控件会让作者看不见它；这里让原文当唯一事实来源，
 * 控件只负责按站点时区展示，作者真的改动控件时才写回 `YYYY-MM-DD HH:mm` 文本。
 */
type Props = {
  /** 日期控件 id，同时派生时间控件与提示的 id。 */
  id: string;
  /** frontmatter 字段名（publishedAt / updatedAt），用作精确编辑框的 name。 */
  name: string;
  /** frontmatter 原文；作者改动控件后写回站点时区字面量。 */
  value: string;
  disabled?: boolean;
  invalid?: boolean;
  ariaDescribedby?: string | undefined;
  onDirty?: (() => void) | undefined;
};

let {
  id,
  name,
  value = $bindable(''),
  disabled = false,
  invalid = false,
  ariaDescribedby,
  onDirty
}: Props = $props();

const timezoneLabel = getSiteTimezone();

const split = $derived(splitDateTimeText(value));
const description = $derived(describeInstant(value));
// 字段为空时没有可解析的偏移，退回到「此刻」的站点时区偏移，徽标始终能显示 +08:00 这类信息。
const offsetText = $derived(description?.offsetText ?? getSiteDateTimeParts(new Date()).offsetText);
const utcHintText = $derived(
  description?.isUtcLiteral
    ? `原文 ${value.trim()} 是 UTC 写法，上面的控件按 ${timezoneLabel} 显示为 ${description.localDateTimeText}。`
    : ''
);

const timeId = `${id}-time`;
const exactId = `${id}-exact`;
const exactErrorId = `${id}-exact-error`;
const utcHintId = `${id}-utc`;

// 精确编辑框是本地草稿：只有解析成功才写回 value，避免把半截文本写进 frontmatter。
let committedValue = $state(value);
let exactText = $state(value);
let exactError = $state('');

$effect(() => {
  if (value === committedValue) return;
  committedValue = value;
  exactText = value;
  exactError = '';
});

const commitValue = (nextText: string) => {
  if (nextText === value) return;
  value = nextText;
  committedValue = nextText;
  onDirty?.();
};

const handleDateInput = (event: Event & { currentTarget: HTMLInputElement }) => {
  commitValue(composeDateTimeText(event.currentTarget.value, split?.time ?? ''));
};

const handleTimeInput = (event: Event & { currentTarget: HTMLInputElement }) => {
  const dateText = split?.date ?? '';
  if (!dateText) return;
  commitValue(composeDateTimeText(dateText, event.currentTarget.value));
};

const commitExactText = () => {
  const trimmed = exactText.trim();
  if (!trimmed) {
    exactError = '';
    commitValue('');
    return;
  }
  if (!splitDateTimeText(trimmed)) {
    // 解析失败不写回：保留上一个有效值，并明确告诉作者这行没有生效。
    exactError = `未写入：${getDateTimeInputErrorMessage()}`;
    return;
  }
  exactError = '';
  commitValue(trimmed);
};
</script>

<div class="admin-editor-frontmatter__datetime-grid">
  <label class="admin-field" class:is-invalid={invalid}>
    <span class="admin-field__label">日期</span>
    <input
      {id}
      class="admin-field__control"
      type="date"
      value={split?.date ?? ''}
      aria-invalid={invalid ? 'true' : undefined}
      aria-describedby={ariaDescribedby}
      {disabled}
      oninput={handleDateInput}
    />
  </label>

  <label class="admin-field" class:is-invalid={invalid}>
    <span class="admin-field__label">时间（可留空）</span>
    <input
      id={timeId}
      class="admin-field__control"
      type="time"
      step="60"
      value={split?.time ?? ''}
      aria-invalid={invalid ? 'true' : undefined}
      aria-describedby={ariaDescribedby}
      disabled={disabled || !split?.date}
      oninput={handleTimeInput}
    />
  </label>
</div>

<span class="admin-badge" data-tone="neutral" title="时间按站点时区解释与写入">
  时区 {timezoneLabel} UTC{offsetText}
</span>

{#if utcHintText}
  <p id={utcHintId}>{utcHintText}</p>
{/if}

<details>
  <summary class="admin-editor-frontmatter__text-action">精确编辑（可粘贴任意受支持写法）</summary>
  <input
    id={exactId}
    class="admin-field__control"
    name={name}
    type="text"
    bind:value={exactText}
    spellcheck="false"
    autocomplete="off"
    placeholder="2026-11-09 14:30"
    aria-invalid={exactError ? 'true' : undefined}
    aria-describedby={exactError ? exactErrorId : utcHintText ? utcHintId : undefined}
    {disabled}
    onchange={commitExactText}
    onblur={commitExactText}
  />
  <p id={exactErrorId} class="admin-content-editor__error" hidden={!exactError}>{exactError}</p>
</details>
