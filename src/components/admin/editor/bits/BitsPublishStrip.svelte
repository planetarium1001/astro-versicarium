<script lang="ts">
import type { AdminBitsEditorValues } from '../../../../lib/admin-console/content-editor-payload';
import {
  composeDateTimeText,
  formatSiteNowDateTimeText,
  splitDateTimeText,
  type SplitDateTime
} from '../../../../lib/admin-console/datetime-field';
import type { AdminContentIssue } from '../shared/content-editor-client';
import AdminEditorIcon from '../shared/AdminEditorIcon.svelte';
import {
  mergeBitsPublishTagsText,
  splitBitsPublishTagsText
} from './bits-publish-tags';
import {
  getFieldDescribedBy,
  getFieldIssueId
} from '../shared/field-issue-a11y';

type Props = {
  value: AdminBitsEditorValues;
  issues?: readonly AdminContentIssue[];
  disabled?: boolean;
  onDirty?: () => void;
};

let {
  value = $bindable(),
  issues = [],
  disabled = false,
  onDirty
}: Props = $props();

const INLINE_TAGS_PLACEHOLDER = '#摄影 #建筑';
const LOCATION_PLACEHOLDER = '(可选)';
const FIELD_ICONS = {
  date: 'calendar-days',
  time: 'clock-3',
  tags: 'hash',
  location: 'map-pin'
} as const;
/** 只填日期时写入的时刻；与时间条改造前一致，避免出现「有日期没时间」的半成品。 */
const DEFAULT_TIME_TEXT = '00:00';

let currentDateTimeUndoValue = $state<string | null>(null);
let currentDateTimeAppliedValue = $state<string | null>(null);
let tagsAutosizeEl = $state<HTMLSpanElement | null>(null);
let locationAutosizeEl = $state<HTMLSpanElement | null>(null);
let tagsMeasureEl = $state<HTMLSpanElement | null>(null);
let locationMeasureEl = $state<HTMLSpanElement | null>(null);

/**
 * 展示值与写入值都交给 datetime-field 的纯函数：无时区写法按站点时区解释，
 * 不再用浏览器本地时区，也不再自带一套 date-only 正则（两套规则必然漂移）。
 * 解析失败时退回空控件，由校验错误提示作者纠正原文。
 */
const getDateTimeParts = (dateText: string): SplitDateTime =>
  splitDateTimeText(dateText) ?? { date: '', time: '', hasTime: false };

/** 日期 + 可选时间 → `YYYY-MM-DD HH:mm`（站点时区字面量，不带偏移）。 */
const buildDateTimeText = (dateText: string, timeText: string): string =>
  composeDateTimeText(dateText, timeText || DEFAULT_TIME_TEXT);

const dateTimeParts = $derived(getDateTimeParts(value.date));
const tagsParts = $derived(splitBitsPublishTagsText(value.tagsText));
const inlineTagsMeasureText = $derived(tagsParts.inlineTagsText || INLINE_TAGS_PLACEHOLDER);
const locationMeasureText = $derived(tagsParts.locationText || LOCATION_PLACEHOLDER);
const getIssue = (path: string): string =>
  issues.find((issue) => issue.path === path)?.message ?? '';
const dateIssue = $derived(getIssue('date'));
const tagsIssue = $derived(getIssue('tags'));
const ISSUE_ID_SCOPE = 'admin-bits-publish';
const currentDateTimeApplied = $derived(
  currentDateTimeUndoValue !== null && currentDateTimeAppliedValue === value.date
);

const updateValue = <TKey extends keyof AdminBitsEditorValues>(
  key: TKey,
  nextValue: AdminBitsEditorValues[TKey]
) => {
  value = {
    ...value,
    [key]: nextValue
  };
  onDirty?.();
};

const clearCurrentDateTimeUndo = () => {
  currentDateTimeUndoValue = null;
  currentDateTimeAppliedValue = null;
};

const updateDatePart = (nextDate: string) => {
  clearCurrentDateTimeUndo();
  updateValue('date', buildDateTimeText(nextDate.trim(), dateTimeParts.time));
};

const updateTimePart = (nextTime: string) => {
  clearCurrentDateTimeUndo();
  updateValue('date', buildDateTimeText(dateTimeParts.date, nextTime.trim()));
};

const updateLocationText = (nextLocation: string) => {
  updateValue('tagsText', mergeBitsPublishTagsText(nextLocation, tagsParts.inlineTagsText));
};

const updateInlineTagsText = (nextTags: string) => {
  updateValue('tagsText', mergeBitsPublishTagsText(tagsParts.locationText, nextTags));
};

const useCurrentDateTime = () => {
  // 站点时区而非浏览器本地时区：作者在不同时区写作时写入的是同一个站点时刻。
  const nextValue = formatSiteNowDateTimeText();
  currentDateTimeUndoValue = value.date;
  currentDateTimeAppliedValue = nextValue;
  updateValue('date', nextValue);
};

const undoCurrentDateTime = () => {
  if (currentDateTimeUndoValue === null) return;
  const previousValue = currentDateTimeUndoValue;
  clearCurrentDateTimeUndo();
  updateValue('date', previousValue);
};

const syncAutosizeInputWidth = (host: HTMLSpanElement, measure: HTMLSpanElement) => {
  const maxInlineSize = Number.parseFloat(getComputedStyle(host).maxWidth);
  const measuredInlineSize = Math.ceil(measure.offsetWidth);
  const nextInlineSize = Number.isFinite(maxInlineSize)
    ? Math.min(measuredInlineSize, maxInlineSize)
    : measuredInlineSize;
  host.style.width = `${nextInlineSize}px`;
};

$effect(() => {
  inlineTagsMeasureText;
  locationMeasureText;

  const tagsHost = tagsAutosizeEl;
  const locationHost = locationAutosizeEl;
  const tagsMeasure = tagsMeasureEl;
  const locationMeasure = locationMeasureEl;
  if (!tagsHost || !locationHost || !tagsMeasure || !locationMeasure) return;

  const sync = () => {
    syncAutosizeInputWidth(tagsHost, tagsMeasure);
    syncAutosizeInputWidth(locationHost, locationMeasure);
  };

  sync();

  if (typeof ResizeObserver === 'undefined') return;

  const observer = new ResizeObserver(sync);
  observer.observe(tagsHost);
  observer.observe(locationHost);

  return () => {
    observer.disconnect();
  };
});
</script>

<section class="admin-bits-publish" aria-label="发布信息">
  <div class="admin-bits-publish-strip" aria-label="发布属性">
    <div class="admin-bits-publish-time-group" aria-label="发布时间">
      <label class="admin-bits-publish-field admin-bits-publish-field--date" class:is-invalid={Boolean(dateIssue)}>
        <span class="admin-bits-publish-field__icon" aria-hidden="true">
          <AdminEditorIcon name={FIELD_ICONS.date} size={12} strokeWidth={1.9} />
        </span>
        <span class="admin-bits-publish-field__label">日期</span>
        <input
          class="admin-bits-publish-field__control"
          type="date"
          value={dateTimeParts.date}
          {disabled}
          aria-invalid={dateIssue ? 'true' : undefined}
          aria-describedby={getFieldDescribedBy(ISSUE_ID_SCOPE, 'date', dateIssue)}
          oninput={(event) => updateDatePart(event.currentTarget.value)}
        />
      </label>

      <label class="admin-bits-publish-field admin-bits-publish-field--time" class:is-invalid={Boolean(dateIssue)}>
        <span class="admin-bits-publish-field__icon" aria-hidden="true">
          <AdminEditorIcon name={FIELD_ICONS.time} size={12} strokeWidth={1.9} />
        </span>
        <span class="admin-bits-publish-field__label">时间</span>
        <input
          class="admin-bits-publish-field__control"
          type="time"
          value={dateTimeParts.time}
          {disabled}
          aria-invalid={dateIssue ? 'true' : undefined}
          aria-describedby={getFieldDescribedBy(ISSUE_ID_SCOPE, 'date', dateIssue)}
          oninput={(event) => updateTimePart(event.currentTarget.value)}
        />
      </label>

      <div class="admin-bits-publish-current" aria-label="写入当前时间快捷操作">
        <button
          class="admin-bits-publish-current__text"
          class:is-active={currentDateTimeApplied}
          type="button"
          {disabled}
          title={currentDateTimeApplied ? '重新写入当前日期和时间' : '写入当前日期和时间'}
          onclick={useCurrentDateTime}
        >写入当前时间</button>

        {#if currentDateTimeApplied}
          <button
            class="admin-bits-publish-current__icon"
            type="button"
            {disabled}
            title="撤回当前时间"
            aria-label="撤回当前时间"
            onclick={undoCurrentDateTime}
          >
            <AdminEditorIcon name="undo-2" size={14} strokeWidth={2.1} />
          </button>
        {/if}
      </div>
    </div>

    <div class="admin-bits-publish-tags-group" aria-label="标签与地点">
      <label class="admin-bits-publish-field admin-bits-publish-field--tags" class:is-invalid={Boolean(tagsIssue)}>
        <span class="admin-bits-publish-field__icon" aria-hidden="true">
          <AdminEditorIcon name={FIELD_ICONS.tags} size={12} strokeWidth={1.9} />
        </span>
        <span class="admin-bits-publish-field__label">标签</span>
        <span class="admin-bits-publish-field__input admin-bits-publish-field__input--tags" bind:this={tagsAutosizeEl}>
          <input
            class="admin-bits-publish-field__control admin-bits-publish-field__control--autosize"
            type="text"
            value={tagsParts.inlineTagsText}
            {disabled}
            placeholder={INLINE_TAGS_PLACEHOLDER}
            aria-invalid={tagsIssue ? 'true' : undefined}
            aria-describedby={getFieldDescribedBy(ISSUE_ID_SCOPE, 'tags', tagsIssue)}
            oninput={(event) => updateInlineTagsText(event.currentTarget.value)}
          />
          <span class="admin-bits-publish-field__measure" bind:this={tagsMeasureEl} aria-hidden="true">{inlineTagsMeasureText}</span>
        </span>
      </label>

      <label class="admin-bits-publish-field admin-bits-publish-field--location" class:is-invalid={Boolean(tagsIssue)}>
        <span class="admin-bits-publish-field__icon" aria-hidden="true">
          <AdminEditorIcon name={FIELD_ICONS.location} size={12} strokeWidth={1.9} />
        </span>
        <span class="admin-bits-publish-field__label">地点</span>
        <span class="admin-bits-publish-field__input admin-bits-publish-field__input--location" bind:this={locationAutosizeEl}>
          <input
            class="admin-bits-publish-field__control admin-bits-publish-field__control--autosize"
            type="text"
            value={tagsParts.locationText}
            {disabled}
            placeholder={LOCATION_PLACEHOLDER}
            aria-invalid={tagsIssue ? 'true' : undefined}
            aria-describedby={getFieldDescribedBy(ISSUE_ID_SCOPE, 'tags', tagsIssue)}
            oninput={(event) => updateLocationText(event.currentTarget.value)}
          />
          <span class="admin-bits-publish-field__measure" bind:this={locationMeasureEl} aria-hidden="true">{locationMeasureText}</span>
        </span>
      </label>
    </div>
  </div>
  <p id={getFieldIssueId(ISSUE_ID_SCOPE, 'date')} class="admin-sr-only" hidden={!dateIssue}>{dateIssue}</p>
  <p id={getFieldIssueId(ISSUE_ID_SCOPE, 'tags')} class="admin-sr-only" hidden={!tagsIssue}>{tagsIssue}</p>
</section>
