import * as cheerio from 'cheerio';
import type { ScrapedSection } from '@etl-tools/shared';

export function extractSections($: cheerio.CheerioAPI): ScrapedSection[] {
  const sections: ScrapedSection[] = [];

  $('h2, h3').each((_, heading) => {
    const title = $(heading).text().trim();
    if (!title) return;

    const items: ScrapedSection['items'] = [];
    let sibling = $(heading).next();

    while (sibling.length && !sibling.is('h2, h3')) {
      if (sibling.is('ul, ol')) {
        sibling.find('li').each((__, li) => {
          const anchor = $(li).find('a').first();
          const name = anchor.length ? anchor.text().trim() : $(li).text().trim();
          const link = anchor.attr('href') || '';
          if (name) {
            const descEl = $(li).find('p, span.description, .desc').first();
            const description = descEl.length ? descEl.text().trim() : undefined;
            items.push({ name, link, description });
          }
        });
      }

      if (sibling.is('dl')) {
        sibling.find('dt').each((__, dt) => {
          const name = $(dt).text().trim();
          const dd = $(dt).next('dd');
          const anchor = $(dt).find('a').first().length ? $(dt).find('a').first() : dd.find('a').first();
          const link = anchor.attr('href') || '';
          const description = dd.length ? dd.text().trim() : undefined;
          if (name) items.push({ name, link, description });
        });
      }

      sibling = sibling.next();
    }

    if (items.length > 0) {
      sections.push({ title, items });
    }
  });

  return sections;
}
