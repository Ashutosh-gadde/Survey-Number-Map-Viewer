/**
 * Nanded Survey Number Georeferencing App
 * Map Initialization, GitHub API Fetching, and Data Export
 */

// ==========================================
// 1. Configuration & State Management
// ==========================================
const AppConfig = {
    githubUser: window.location.hostname === "localhost" ? "YOUR_GITHUB_USERNAME" : window.location.hostname.split('.')[0],
    repoName: window.location.hostname === "localhost" ? "YOUR_REPO_NAME" : window.location.pathname.split('/')[1],
    get baseURL() { return `https://raw.githubusercontent.com/${this.githubUser}/${this.repoName}/main/`; }
};

// Note: Client-side auth is inherently insecure. Use only for mockups/demos.
const USERS = {
    "Admin": { password: "Admin@321", access: "ALL" },
    "Nanded_district": { password: "Nanded@123", access: "ALL" }
};

// Global App State
const State = {
    activeUser: null,
    layers: { polygon: null, line: null, point: null, highlight: null },
    currentBasemap: null
};

// Fix Leaflet Popup/Tooltip Pan Jumping
L.Popup.prototype._adjustPan = function(){};
L.Tooltip.prototype._adjustPan = function(){};

// Set up Projection for DXF
proj4.defs("EPSG:32643", "+proj=utm +zone=43 +datum=WGS84 +units=m +no_defs");


// ==========================================
// 2. Map Initialization
// ==========================================
const map = L.map('map', { zoomControl: false, doubleClickZoom: false }).setView([19.16, 77.31], 10);
L.control.zoom({ position: 'topleft' }).addTo(map);
L.control.scale({ imperial: false, metric: true, position: 'bottomleft' }).addTo(map);

// Measurement Control
new L.Control.Measure({
    position: 'bottomright',
    primaryLengthUnit: 'meters',
    secondaryLengthUnit: 'kilometers',
    primaryAreaUnit: 'sqmeters',
    secondaryAreaUnit: 'hectares'
}).addTo(map);

// Basemaps
const basemaps = {
    hybrid: L.tileLayer('https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}', { maxZoom: 22 }),
    satellite: L.tileLayer('https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}', { maxZoom: 22 }),
    road: L.tileLayer('https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}', { maxZoom: 22 }),
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 })
};

State.currentBasemap = basemaps.hybrid.addTo(map);


// ==========================================
// 3. UI Interactions & Event Listeners
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
    
    // Sidebar & Menus
    document.getElementById("sidebarToggle").addEventListener("click", () => {
        document.getElementById("sidebar").classList.toggle("collapsed");
        setTimeout(() => map.invalidateSize(), 300);
    });

    document.getElementById("layer-toggle-btn").addEventListener("click", () => {
        document.getElementById("right-layer-panel").classList.toggle("active");
    });

    document.getElementById("toggleDownloadBtn").addEventListener("click", () => {
        const menu = document.getElementById("downloadMenu");
        menu.style.display = menu.style.display === "block" ? "none" : "block";
    });

    // Login
    document.getElementById("loginBtn").addEventListener("click", handleLogin);

    // Basemap switching
    document.getElementsByName("basemap").forEach(radio => {
        radio.addEventListener("change", (e) => {
            map.removeLayer(State.currentBasemap);
            State.currentBasemap = basemaps[e.target.value];
            map.addLayer(State.currentBasemap);
        });
    });

    // GIS Layer Visibility
    document.getElementById("toggle-polygon").addEventListener("change", function() { toggleLayer(this.checked, State.layers.polygon); });
    document.getElementById("toggle-line").addEventListener("change", function() { toggleLayer(this.checked, State.layers.line); });
    document.getElementById("toggle-point").addEventListener("change", function() { toggleLayer(this.checked, State.layers.point); });

    // Dynamic Selectors & Search
    document.getElementById("talukaSelect").addEventListener("change", loadVillages);
    document.getElementById("villageSelect").addEventListener("change", loadGISData);
    document.getElementById("searchBtn").addEventListener("click", searchSurvey);

    // Map Utilities (Coordinates & Location)
    map.on("mousemove", (e) => {
        document.getElementById("coords-display").innerHTML = `Lat: ${e.latlng.lat.toFixed(5)}, Lng: ${e.latlng.lng.toFixed(5)}`;
    });

    document.getElementById("location-btn").addEventListener("click", () => {
        updateStatus("Searching device location...");
        map.locate({ setView: true, maxZoom: 16 });
    });

    map.on('locationfound', (e) => {
        L.circle(e.latlng, e.accuracy).addTo(map);
        updateStatus("🎯 Located successfully");
    });

    map.on('locationerror', () => {
        alert("Location access denied or unavailable.");
        updateStatus("❌ Location Error");
    });

    // Exports
    document.getElementById("downloadDxfBtn").addEventListener("click", downloadDXF);
    document.getElementById("downloadKmlBtn").addEventListener("click", downloadKML);
});


// ==========================================
// 4. Core Logic & API Functions
// ==========================================
function updateStatus(msg) { document.getElementById("status").innerHTML = msg; }
function toggleLoading(show) { document.getElementById("loadingOverlay").style.display = show ? "flex" : "none"; }
function toggleLayer(isChecked, layer) {
    if (!layer) return;
    isChecked ? map.addLayer(layer) : map.removeLayer(layer);
}

function handleLogin() {
    const user = document.getElementById("username").value.trim();
    const pass = document.getElementById("password").value.trim();

    if (USERS[user] && USERS[user].password === pass) {
        State.activeUser = USERS[user];
        document.getElementById("loginOverlay").style.display = "none";
        loadTalukas();
    } else {
        document.getElementById("loginError").innerHTML = "Invalid Login Credentials";
    }
}

async function loadTalukas() {
    try {
        updateStatus("Loading Talukas...");
        const res = await fetch(`https://api.github.com/repos/${AppConfig.githubUser}/${AppConfig.repoName}/contents`);
        const data = await res.json();
        
        if (data.message && data.message.includes("Not Found")) throw new Error("Repository configuration error.");

        const select = document.getElementById("talukaSelect");
        select.innerHTML = `<option value="">-- Select Taluka --</option>`;
        
        data.filter(item => item.type === "dir").forEach(item => {
            select.add(new Option(item.name, item.name));
        });

        select.disabled = false;
        updateStatus("✅ Talukas Loaded");
    } catch (err) {
        updateStatus("❌ Taluka Load Failed: " + err.message);
    }
}

async function loadVillages() {
    const taluka = this.value;
    if (!taluka) return;

    try {
        const res = await fetch(`https://api.github.com/repos/${AppConfig.githubUser}/${AppConfig.repoName}/contents/${taluka}`);
        const data = await res.json();
        
        const select = document.getElementById("villageSelect");
        select.innerHTML = `<option value="">-- Select Village --</option>`;
        
        data.filter(item => item.type === "dir").forEach(v => {
            select.add(new Option(v.name, v.name));
        });

        select.disabled = false;
        updateStatus("✅ Villages Loaded");
    } catch (err) {
        updateStatus("❌ Village Load Failed");
    }
}

async function loadGISData() {
    const taluka = document.getElementById("talukaSelect").value;
    const village = this.value;
    if (!village) return;

    try {
        toggleLoading(true);

        // Clear Existing Layers
        ["polygon", "line", "point", "highlight"].forEach(key => {
            if (State.layers[key]) {
                map.removeLayer(State.layers[key]);
                State.layers[key] = null;
            }
        });

        ["polygon", "line", "point"].forEach(type => {
            document.getElementById(`toggle-${type}`).disabled = true;
        });

        // Fetch directory contents to find correct files
        const res = await fetch(`https://api.github.com/repos/${AppConfig.githubUser}/${AppConfig.repoName}/contents/${taluka}/${village}`);
        const files = await res.json();

        let filesToLoad = { polygon: null, line: null, point: null };

        files.forEach(file => {
            const name = file.name.toLowerCase();
            if (name.includes("poly")) filesToLoad.polygon = file.name;
            else if (name.includes("line")) filesToLoad.line = file.name;
            else if (name.includes("point") || name.includes("text")) filesToLoad.point = file.name;
        });

        // Load Polygon Layer
        if (filesToLoad.polygon) {
            const polygonData = await (await fetch(`${AppConfig.baseURL}${taluka}/${village}/${filesToLoad.polygon}`)).json();
            State.layers.polygon = L.geoJSON(polygonData, {
                renderer: L.canvas(),
                style: { color: "red", weight: 1, fillOpacity: 0.02 },
                onEachFeature: (feature, layer) => {
                    const props = feature.properties || {};
                    const survey = props.survey_no || props.Survey_No || props.gat_no || props.Gat_No || props.sr_no || props.SR_NO || props.Text;
                    if (survey) {
                        layer.bindTooltip(String(survey), { permanent: true, direction: "center", className: "cadastral-label" });
                    }
                }
            }).addTo(map);

            document.getElementById("toggle-polygon").checked = true;
            document.getElementById("toggle-polygon").disabled = false;
            map.fitBounds(State.layers.polygon.getBounds(), { padding: [20, 20], maxZoom: 20 });
        }

        // Load Line Layer
        if (filesToLoad.line) {
            const lineData = await (await fetch(`${AppConfig.baseURL}${taluka}/${village}/${filesToLoad.line}`)).json();
            State.layers.line = L.geoJSON(lineData, {
                renderer: L.canvas(),
                style: (feature) => {
                    const source = ((feature.properties || {}).sourcel || "").toString();
                    if (source.includes("Road")) return { color: "black", weight: 2 };
                    if (source.includes("River") || source.includes("Nala")) return { color: "blue", weight: 2 };
                    return { color: "#00ffff", weight: 1.5 };
                }
            }).addTo(map);
            document.getElementById("toggle-line").checked = true;
            document.getElementById("toggle-line").disabled = false;
        }

        // Load Point Layer
        if (filesToLoad.point) {
            const pointData = await (await fetch(`${AppConfig.baseURL}${taluka}/${village}/${filesToLoad.point}`)).json();
            State.layers.point = L.geoJSON(pointData, {
                renderer: L.canvas(),
                pointToLayer: (feature, latlng) => L.circleMarker(latlng, { radius: 0, opacity: 0, fillOpacity: 0 }),
                onEachFeature: (feature, layer) => {
                    const label = feature.properties.Text || feature.properties.name;
                    if (label) layer.bindTooltip(String(label), { permanent: true, direction: "top", className: "cadastral-label" });
                }
            }).addTo(map);
            document.getElementById("toggle-point").checked = true;
            document.getElementById("toggle-point").disabled = false;
        }

        document.getElementById("searchBox").disabled = false;
        document.getElementById("searchBtn").disabled = false;
        updateStatus("✅ GIS Loaded");

    } catch (err) {
        console.error(err);
        updateStatus("❌ GIS Loading Failed");
    } finally {
        toggleLoading(false);
    }
}

function searchSurvey() {
    const val = document.getElementById("searchBox").value.trim().toLowerCase();
    if (!val || !State.layers.polygon) return;

    if (State.layers.highlight) map.removeLayer(State.layers.highlight);

    State.layers.polygon.eachLayer(layer => {
        const props = layer.feature.properties || {};
        const survey = props.survey_no || props.Survey_No || props.gat_no || props.Gat_No || props.sr_no || props.SR_NO;

        if (survey && String(survey).trim().toLowerCase() === val) {
            State.layers.highlight = L.geoJSON(layer.feature, {
                style: { color: "#00ffff", weight: 4, fillOpacity: 0.35 }
            }).addTo(map);
            map.fitBounds(layer.getBounds(), { maxZoom: 20, padding: [40, 40] });
        }
    });
}


// ==========================================
// 5. Geometry Export (DXF & KML)
// ==========================================
function downloadDXF() {
    if (!State.layers.polygon) return alert("No polygon data loaded.");
    
    let dxf = `\n0\nSECTION\n2\nENTITIES\n`;

    State.layers.polygon.eachLayer(layer => {
        const geom = layer.feature.geometry;
        if (geom.type === "Polygon") geom.coordinates.forEach(ring => dxf += buildDXFPolyline(ring));
        else if (geom.type === "MultiPolygon") {
            geom.coordinates.forEach(poly => poly.forEach(ring => dxf += buildDXFPolyline(ring)));
        }
    });

    dxf += `\n0\nENDSEC\n0\nEOF\n`;
    triggerFileDownload(dxf, 'application/dxf', 'survey_data.dxf');
}

function buildDXFPolyline(ring) {
    let output = `\n0\nPOLYLINE\n8\n0\n66\n1\n70\n1\n`;
    ring.forEach(coord => {
        const p = proj4("EPSG:4326", "EPSG:32643", [coord[0], coord[1]]);
        output += `\n0\nVERTEX\n8\n0\n10\n${p[0]}\n20\n${p[1]}\n30\n0\n`;
    });
    return output + `\n0\nSEQEND\n`;
}

function downloadKML() {
    if (!State.layers.polygon) return alert("No polygon data loaded.");

    let kml = `<?xml version="1.0" encoding="UTF-8"?>\n<kml xmlns="http://www.opengis.net/kml/2.2">\n<Document>\n`;

    State.layers.polygon.eachLayer(layer => {
        const geom = layer.feature.geometry;
        if (geom.type === "Polygon") kml += buildKMLPolygon(geom.coordinates);
        else if (geom.type === "MultiPolygon") {
            geom.coordinates.forEach(poly => kml += buildKMLPolygon(poly));
        }
    });

    kml += `\n</Document>\n</kml>\n`;
    triggerFileDownload(kml, 'application/vnd.google-earth.kml+xml', 'survey_data.kml');
}

function buildKMLPolygon(coordsArray) {
    const ring = coordsArray[0];
    let output = `\n<Placemark>\n<Polygon>\n<tessellate>1</tessellate>\n<outerBoundaryIs>\n<LinearRing>\n<coordinates>\n`;
    ring.forEach(coord => output += `\n${coord[0]},${coord[1]},0\n`);
    output += `\n${ring[0][0]},${ring[0][1]},0\n</coordinates>\n</LinearRing>\n</outerBoundaryIs>\n</Polygon>\n</Placemark>\n`;
    return output;
}

function triggerFileDownload(content, mimeType, filename) {
    const blob = new Blob([content], { type: mimeType });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}
