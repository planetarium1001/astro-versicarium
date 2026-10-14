import { buildBlogFeed } from './blog/rss.xml.js';
import { getThemeSettings } from '../lib/theme-settings';

const { settings } = getThemeSettings();

export async function GET(context) {
  return buildBlogFeed(context, {
    title: settings.site.title,
    description: settings.site.description
  });
}
