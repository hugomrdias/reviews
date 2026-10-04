// Stand-in for mermaid during SSR. Diagrams only render in the browser
// (MermaidDiagram loads it from an effect), so the Worker never bundles it.
export default {}
