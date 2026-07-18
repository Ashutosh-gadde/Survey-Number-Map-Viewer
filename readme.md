# Nanded Survey Number Georeferencing System

A lightweight, client-side web application for visualizing, searching, and exporting cadastral (survey) map data for the Nanded district using Leaflet.js.

## Features
- **Dynamic Data Fetching**: Retrieves GeoJSON files directly from this repository using the GitHub REST API.
- **Cadastral Overlay**: Renders polygons (survey boundaries), polylines (roads/waterways), and point texts (labels) on top of various basemaps.
- **Search Functionality**: Quickly locate specific survey numbers within a village.
- **Data Export**: Convert and download the active map area to `DXF` (EPSG:32643 Projection) or `KML` formats for CAD/GIS work.
- **Measurement Tools**: Built-in area and distance calculation tools.

## Folder Structure
The GitHub repository must be structured carefully so the App API can fetch the geographic files.

```text
/
├── index.html        # Main Entry Point
├── style.css         # Styling 
├── app.js            # Application Logic
└── [Taluka_Name]/    # e.g., Nanded, Ardhapur
    └── [Village_Name]/ 
        ├── polygon.geojson
        ├── line.geojson
        └── point.geojson
