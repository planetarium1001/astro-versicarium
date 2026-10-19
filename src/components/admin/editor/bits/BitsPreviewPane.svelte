<script lang="ts">
import type { BitsCardViewModel } from '../../../../lib/bits-card-view-model';
import { getBitAnchorId } from '../../../../lib/bits-public-routing';

type Props = {
  viewModel: BitsCardViewModel;
  previewHtml?: string;
  previewBusy?: boolean;
  previewError?: string;
  onScrollElementChange?: (element: HTMLElement | null) => void;
};

let {
  viewModel,
  previewHtml = '',
  previewBusy = false,
  previewError = '',
  onScrollElementChange
}: Props = $props();

let previewScrollElement = $state<HTMLElement | null>(null);

const handleAvatarError = (event: Event) => {
  const image = event.currentTarget as HTMLImageElement;
  image.parentElement?.classList.add('is-fallback');
  image.remove();
};

$effect(() => {
  const element = previewScrollElement;
  onScrollElementChange?.(element);
  return () => {
    onScrollElementChange?.(null);
  };
});
</script>

<section class="admin-bits-preview" aria-label="卡片预览">
  <div
    class="admin-bits-preview__scroller"
    data-refreshing={previewBusy && previewHtml ? 'true' : undefined}
    bind:this={previewScrollElement}
  >
    <div class="admin-bits-preview__list">
      <article
        class="bit-card"
        id={getBitAnchorId(viewModel.id)}
        data-bit
        data-bit-key={viewModel.id}
        data-slug={viewModel.slug}
      >
        <div class="bit-author">
          <div class={`avatar${viewModel.authorAvatar ? ' avatar--image' : ' is-fallback'}`} aria-hidden="true">
            {#if viewModel.authorAvatar}
              <img
                src={viewModel.authorAvatar}
                alt=""
                width="32"
                height="32"
                loading="lazy"
                decoding="async"
                onerror={handleAvatarError}
              />
            {/if}
            <span class="avatar-fallback">{viewModel.avatarLetter}</span>
          </div>
          <div class="name">{viewModel.authorName}</div>
        </div>

        {#if previewError}
          <div class="bit-body">
            <p class="admin-bits-preview__feedback" data-tone="error">{previewError}</p>
          </div>
        {:else if viewModel.body.shouldRenderFull && !viewModel.body.truncated && previewHtml}
          <div class="bit-body bit-body--rich">
            {@html previewHtml}
          </div>
        {:else if viewModel.body.excerpt}
          <div class="bit-body">
            <p class="bit-body__excerpt">{viewModel.body.excerpt}</p>
            {#if viewModel.body.truncated}
              <p class="bit-body-hint" data-bit-body-hint>查看全文</p>
            {/if}
          </div>
        {/if}

        {#if viewModel.firstImage}
          <div class="bit-media bit-media--single">
            <div
              class="bit-media-item bit-media-item--single"
            >
              <img
                src={viewModel.firstImage.src}
                alt={viewModel.firstImage.alt}
                width={viewModel.firstImage.width}
                height={viewModel.firstImage.height}
                loading="lazy"
              />
            </div>
          </div>
        {:else if viewModel.imageItems.length > 1}
          <div class="bit-media bit-media--grid">
            <div class="bit-media-grid">
              {#each viewModel.visibleImages as image, index}
                {@const isMore = index === viewModel.visibleImages.length - 1 && viewModel.moreCount > 0}
                <div
                  class={`bit-media-item${isMore ? ' bit-media-item--more' : ''}`}
                >
                  <img
                    src={image.src}
                    alt={image.alt}
                    width={image.width}
                    height={image.height}
                    loading="lazy"
                  />
                  {#if isMore}
                    <span class="bit-media-more" aria-hidden="true">
                      <span class="bit-media-more-short">+ {viewModel.moreCount}</span>
                      <span class="bit-media-more-full">查看其余{viewModel.moreCount}张</span>
                    </span>
                  {/if}
                </div>
              {/each}
            </div>
          </div>
        {/if}

        {#if viewModel.imageItems.length}
          <div hidden aria-hidden="true">
            {#each viewModel.imageItems as image}
              <span
                data-bit-image-item
                data-bit-image-src={image.src}
                data-bit-image-alt={image.alt}
                data-bit-image-width={image.width}
                data-bit-image-height={image.height}
              ></span>
            {/each}
          </div>
        {/if}

        <div class="bit-meta">
          {#if viewModel.hasTags}
            <div class="bit-tags">
              {#if viewModel.placeTag}
                <span class="bit-tag bit-tag--place">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>
                  <span class="bit-tag-text">{viewModel.placeTag.label}</span>
                </span>
              {/if}
              {#if viewModel.normalTagItems.length}
                <span class="bit-tag bit-tag--normal">
                  <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" focusable="false"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
                  <span class="bit-tag-list">
                    {#each viewModel.normalTagItems as tag}
                      <span class="bit-tag-token">#{tag.label}</span>
                    {/each}
                  </span>
                </span>
              {/if}
            </div>
          {/if}
          <div>{viewModel.dateLabel}</div>
        </div>
      </article>
    </div>
  </div>
</section>
