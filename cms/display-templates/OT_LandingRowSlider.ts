import { displayTemplate } from '@optimizely/cms-sdk'

export const OT_LandingRowSlider = displayTemplate({
  key: 'OT_LandingRowSlider',
  displayName: 'Slider Row',
  nodeType: 'row',
  isDefault: false,
  settings: {
    verticalPadding: {
      displayName: 'Vertical padding',
      editor: 'select',
      sortOrder: 10,
      choices: {
        none:   { displayName: 'None',   sortOrder: 10 },
        small:  { displayName: 'Small',  sortOrder: 20 },
        medium: { displayName: 'Medium', sortOrder: 30 },
        large:  { displayName: 'Large',  sortOrder: 40 },
        xl:     { displayName: 'XL',     sortOrder: 50 },
      },
    },
    backgroundColor: {
      displayName: 'Background color',
      editor: 'select',
      sortOrder: 20,
      choices: {
        none:      { displayName: 'None',       sortOrder: 10 },
        canvas:    { displayName: 'Canvas',     sortOrder: 20 },
        surface:   { displayName: 'Surface',    sortOrder: 30 },
        brand:     { displayName: 'Brand',      sortOrder: 40 },
        brandDeep: { displayName: 'Brand deep', sortOrder: 50 },
      },
    },
    sliderTransition: {
      displayName: 'Transition style',
      editor: 'select',
      sortOrder: 100,
      choices: {
        slide: { displayName: 'Slide — items translate horizontally (Default)', sortOrder: 10 },
        fade:  { displayName: 'Fade — crossfade between items',                 sortOrder: 20 },
        cover: { displayName: 'Cover — active item at full scale, others shrink', sortOrder: 30 },
        morph: { displayName: 'Morph — fade + blur dissolve',                   sortOrder: 40 },
      },
    },
    sliderControls: {
      displayName: 'Navigation',
      editor: 'select',
      sortOrder: 110,
      choices: {
        both:   { displayName: 'Arrows + dots (Default)', sortOrder: 10 },
        arrows: { displayName: 'Arrows only',             sortOrder: 20 },
        dots:   { displayName: 'Dots only',               sortOrder: 30 },
        none:   { displayName: 'None — swipe/drag only',  sortOrder: 40 },
      },
    },
    sliderAutoplay: {
      displayName: 'Auto-advance',
      editor: 'select',
      sortOrder: 120,
      choices: {
        off:    { displayName: 'Off (Default)', sortOrder: 10 },
        slow:   { displayName: 'Slow — 8s',    sortOrder: 20 },
        medium: { displayName: 'Medium — 5s',  sortOrder: 30 },
        fast:   { displayName: 'Fast — 3s',    sortOrder: 40 },
      },
    },
    sliderLoop: {
      displayName: 'Loop behavior',
      editor: 'select',
      sortOrder: 130,
      choices: {
        loop:   { displayName: 'Loop — wraps from last to first (Default)', sortOrder: 10 },
        none:   { displayName: 'Stop — pauses at first and last',           sortOrder: 20 },
        bounce: { displayName: 'Bounce — reverses direction at each end',   sortOrder: 30 },
      },
    },
    sliderPeek: {
      displayName: 'Peek next slide',
      editor: 'select',
      sortOrder: 140,
      choices: {
        none: { displayName: 'None — full bleed (Default)', sortOrder: 10 },
        sm:   { displayName: 'Small — ~8% of next visible', sortOrder: 20 },
        md:   { displayName: 'Medium — ~15% visible',       sortOrder: 30 },
        lg:   { displayName: 'Large — ~25% visible',        sortOrder: 40 },
      },
    },
    sliderSnap: {
      displayName: 'Scroll snap',
      editor: 'select',
      sortOrder: 150,
      choices: {
        single: { displayName: 'One at a time (Default)', sortOrder: 10 },
        free:   { displayName: 'Free scroll — momentum',  sortOrder: 20 },
      },
    },
    sliderMobileItems: {
      displayName: 'Items visible on mobile',
      editor: 'select',
      sortOrder: 160,
      choices: {
        one:  { displayName: '1 item (Default)',            sortOrder: 10 },
        two:  { displayName: '2 items',                     sortOrder: 20 },
        auto: { displayName: 'Auto — follow column widths', sortOrder: 30 },
      },
    },
    entranceAnimation: {
      displayName: 'Entrance animation',
      editor: 'select',
      sortOrder: 170,
      choices: {
        none:  { displayName: 'None',     sortOrder: 10 },
        fade:  { displayName: 'Fade in',  sortOrder: 20 },
        slide: { displayName: 'Slide up', sortOrder: 30 },
      },
    },
  },
})
