/**
 * The stage's one job beyond mounting five panes: turning `SectionDef.layout`
 * into the container the articles actually sit in (§6.4).
 *
 * sections.test.ts already asserts which sections are `split`. What it cannot see
 * is whether the stage does anything with it, which is the state this codebase was
 * in before Milestone 6 — the Contact brief said "form left, direct channels
 * right" and every section got one `flex flex-col` column regardless.
 *
 * jsdom loads no stylesheet, so the class list is the assertion. That is the same
 * bargain Collapsible.test.tsx and IconButton.test.tsx strike, and it is a real
 * one here: the two arms are mutually exclusive whole strings precisely so a
 * regression shows up as the wrong string rather than as two competing utilities
 * whose winner depends on Tailwind's emission order.
 */
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { SectionStage } from '@/components/shell/SectionStage'
import { SECTIONS } from '@/content/sections'
import { sectionDomId } from '@/lib/dom'
import { NavigationProvider } from '@/providers/NavigationProvider'
import { ThemeProvider } from '@/providers/ThemeProvider'
import { ViewportProvider } from '@/providers/ViewportProvider'
import type { SectionId } from '@/types/content'

function renderStage(initialPath = '/') {
  return render(
    <ViewportProvider>
      <ThemeProvider>
        <MemoryRouter initialEntries={[initialPath]}>
          <NavigationProvider>
            <SectionStage />
          </NavigationProvider>
        </MemoryRouter>
      </ThemeProvider>
    </ViewportProvider>,
  )
}

/**
 * The element the articles are children of. Section.tsx renders its title block
 * and then `children`, so the container is the pane's last element child — read
 * positionally rather than by class, since the class is what is under test.
 */
function articleContainer(id: SectionId): HTMLElement {
  const pane = document.getElementById(sectionDomId(id))
  if (!pane) throw new Error(`no pane rendered for section "${id}"`)
  const container = pane.lastElementChild
  if (!(container instanceof HTMLElement)) {
    throw new Error(`section "${id}" rendered no article container`)
  }
  return container
}

describe('<SectionStage> layout', () => {
  it('stacks a section with no layout stated', () => {
    renderStage()

    const container = articleContainer('about')
    expect(container).toHaveClass('flex', 'flex-col')
    expect(container).not.toHaveClass('grid')
  })

  it('gives the split section two columns from lg up and one below', () => {
    renderStage()

    const container = articleContainer('contact')
    // No `grid-cols-1`: a bare `grid` is one column already, so the narrow case
    // is the default rather than a second grid-template-columns utility racing
    // the first.
    expect(container).toHaveClass('grid', 'lg:grid-cols-2')
    expect(container).not.toHaveClass('grid-cols-1')
    expect(container).not.toHaveClass('flex-col')
  })

  it('keeps both split articles in the same container, in content order', () => {
    // Two columns only happen if the pair are siblings in one grid. Rendering
    // each article in its own wrapper would look identical while stacking.
    renderStage()

    const children = [...articleContainer('contact').children]
    expect(children.map((child) => child.id)).toEqual(['contact-form', 'contact-channels'])
  })

  it('applies exactly one of the two arms to every section', () => {
    // Guards the resolution of an absent `layout` for all five at once: a
    // container carrying both `flex-col` and `lg:grid-cols-2` is the shape the
    // lookup exists to make impossible.
    renderStage()

    for (const section of SECTIONS) {
      const container = articleContainer(section.id)
      const stacked = container.classList.contains('flex-col')
      const split = container.classList.contains('lg:grid-cols-2')
      expect(stacked !== split, section.id).toBe(true)
      expect(split, section.id).toBe(section.layout === 'split')
    }
  })
})
