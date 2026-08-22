import { afterEach, describe, expect, it } from 'vitest';

import { defaultLocaleFactory } from './app.config';

describe('defaultLocaleFactory', () => {
  afterEach(() => localStorage.removeItem('lang'));

  it('uses en-US when the BI language setting is absent', () => {
    localStorage.removeItem('lang');

    expect(defaultLocaleFactory()).toBe('en-US');
    expect(localStorage.getItem('lang')).toBe('en-US');
  });
});
