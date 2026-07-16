import { describe, it, expect } from 'vitest';
import { mount } from '@vue/test-utils';
import { Button } from '../index';

describe('Button', () => {
  it('renders a plain <button> by default', () => {
    const w = mount(Button, { slots: { default: 'Click' } });
    expect(w.find('button').exists()).toBe(true);
    expect(w.text()).toBe('Click');
  });

  it('renders an <a rel="noopener"> when href is set', () => {
    const w = mount(Button, {
      props: { href: 'https://example.com/file.apk', size: 'lg' },
      slots: { default: 'Download' },
    });
    const a = w.find('a');
    expect(a.exists()).toBe(true);
    expect(a.attributes('href')).toBe('https://example.com/file.apk');
    expect(a.attributes('rel')).toBe('noopener');
    expect(w.find('button').exists()).toBe(false);
    expect(a.classes().length).toBeGreaterThan(0); // shares the button styling
  });
});
