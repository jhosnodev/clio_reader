import { describe, expect, it } from 'vitest';

import { parseComicInfoXml } from '../src/comic-info.js';

const SAMPLE = `<?xml version="1.0" encoding="utf-8"?>
<ComicInfo xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance">
  <Title>The Title</Title>
  <Series>My Series</Series>
  <Number>3</Number>
  <Writer>Jane Doe &amp; John Roe</Writer>
  <Penciller>Artist Name</Penciller>
  <LanguageISO>en</LanguageISO>
  <Cover>2</Cover>
</ComicInfo>`;

describe('parseComicInfoXml', () => {
  it('extracts metadata fields', () => {
    const info = parseComicInfoXml(SAMPLE);
    expect(info.Title).toBe('The Title');
    expect(info.Series).toBe('My Series');
    expect(info.Number).toBe('3');
    expect(info.Writer).toBe('Jane Doe & John Roe');
    expect(info.Penciller).toBe('Artist Name');
    expect(info.LanguageISO).toBe('en');
    expect(info.Cover).toBe('2');
  });

  it('returns empty object when the root is empty', () => {
    expect(parseComicInfoXml('<ComicInfo></ComicInfo>')).toEqual({});
  });

  it('ignores empty tags', () => {
    const info = parseComicInfoXml('<ComicInfo><Title>   </Title></ComicInfo>');
    expect(info.Title).toBeUndefined();
  });
});
