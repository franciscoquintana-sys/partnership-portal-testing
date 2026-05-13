import SlideBase from './SlideBase'

// Blank slide reserved for the per-country detail content. Slide 9 ("Country
// Detail" map + filters) advances to this slide when a country is picked.
// We render an empty SlideBase shell so the slide takes the deck's standard
// chrome (section pill + Yuno wordmark) while the body stays empty until
// the detail content is wired in.

export default function SlideCountryDetailPage() {
  return <SlideBase section="Country Detail" />
}
