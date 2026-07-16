import { describe, it, expect } from 'vitest';
import { mount, RouterLinkStub } from '@vue/test-utils';
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
    expect(a.classes()).toContain('inline-flex'); // shares the button styling
    expect(a.classes()).toContain('h-10'); // size="lg"
  });

  it('renders a RouterLink when to is set', () => {
    const w = mount(Button, {
      props: { to: '/register' },
      slots: { default: 'Go' },
      global: { stubs: { RouterLink: RouterLinkStub } },
    });
    const link = w.findComponent(RouterLinkStub);
    expect(link.exists()).toBe(true);
    expect(link.props('to')).toBe('/register');
    expect(w.find('a[href]').exists()).toBe(false); // not the href branch
    expect(w.find('button').exists()).toBe(false);
    expect(w.find('a').classes()).toContain('inline-flex'); // shares the button styling
  });
});
