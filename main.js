import * as d3 from "d3";
import * as topojson from "topojson-client";

const parseDate = d3.timeParse("%Y-%m-%d");
const formatMonth = d3.timeFormat("%b %Y");

let worldGeo = null;

async function loadData() {
  const raw = await d3.csv("dataset/Cleaned_tech_layoffs.csv");

  const data = raw
    .map((d) => ({
      company: d.Company,
      country: d.Country,
      continent: d.Continent,
      industry: d.Industry,
      laidOff: +d.Laid_Off || 0,
      date: parseDate(d.Date_layoffs),
      lat: +d.latitude || 0,
      lon: +d.longitude || 0,
      year: +d.Year || 0,
    }))
    .filter((d) => d.date !== null);

  worldGeo = await d3.json(
    "https://cdn.jsdelivr.net/npm/world-atlas@2/countries-110m.json"
  );

  renderTimeline(data);
  renderMap(data);
  renderTreemap(data);
}

// ── Chart 1: Timeline Bar Chart ──────────────────────────────────────

function renderTimeline(data) {
  const container = document.querySelector("#timeline .chart-area");
  const width = container.clientWidth;
  const height = 280;
  const margin = { top: 10, right: 20, bottom: 50, left: 60 };
  const iw = width - margin.left - margin.right;
  const ih = height - margin.top - margin.bottom;

  const monthly = d3.rollups(
    data,
    (v) => d3.sum(v, (d) => d.laidOff),
    (d) => d3.timeMonth(d.date)
  );
  monthly.sort((a, b) => a[0] - b[0]);

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const g = svg
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3
    .scaleBand()
    .domain(monthly.map((d) => d[0]))
    .range([0, iw])
    .padding(0.15);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(monthly, (d) => d[1])])
    .nice()
    .range([ih, 0]);

  g.append("g")
    .attr("class", "axis")
    .attr("transform", `translate(0,${ih})`)
    .call(
      d3
        .axisBottom(x)
        .tickValues(x.domain().filter((_, i) => i % 3 === 0))
        .tickFormat(formatMonth)
    )
    .selectAll("text")
    .attr("transform", "rotate(-40)")
    .style("text-anchor", "end");

  g.append("g").attr("class", "axis").call(d3.axisLeft(y).ticks(6));

  g.selectAll(".bar")
    .data(monthly)
    .join("rect")
    .attr("class", "bar")
    .attr("x", (d) => x(d[0]))
    .attr("y", ih)
    .attr("width", x.bandwidth())
    .attr("height", 0)
    .transition()
    .duration(600)
    .delay((_, i) => i * 15)
    .attr("y", (d) => y(d[1]))
    .attr("height", (d) => ih - y(d[1]));
}

// ── Chart 2: Bubble Map ─────────────────────────────────────────────

function renderMap(data) {
  const container = document.querySelector("#map .chart-area");
  const width = container.clientWidth;
  const height = 420;

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const projection = d3
    .geoNaturalEarth1()
    .scale(width / 5.5)
    .translate([width / 2, height / 2]);

  const path = d3.geoPath().projection(projection);

  svg
    .append("g")
    .selectAll("path")
    .data(topojson.feature(worldGeo, worldGeo.objects.countries).features)
    .join("path")
    .attr("class", "map-land")
    .attr("d", path);

  const validPoints = data.filter(
    (d) => d.lat !== 0 && d.lon !== 0 && d.laidOff > 0
  );

  const radius = d3
    .scaleSqrt()
    .domain([0, d3.max(validPoints, (d) => d.laidOff)])
    .range([1, 25]);

  svg
    .append("g")
    .selectAll("circle")
    .data(validPoints)
    .join("circle")
    .attr("class", "bubble")
    .attr("cx", (d) => projection([d.lon, d.lat])[0])
    .attr("cy", (d) => projection([d.lon, d.lat])[1])
    .attr("r", (d) => radius(d.laidOff));
}

// ── Chart 3: Treemap ─────────────────────────────────────────────────

function renderTreemap(data) {
  const container = document.querySelector("#treemap .chart-area");
  const width = container.clientWidth;
  const height = 420;

  const byIndustry = d3.rollups(
    data,
    (v) => d3.sum(v, (d) => d.laidOff),
    (d) => d.industry
  );

  const sorted = byIndustry.sort((a, b) => b[1] - a[1]);

  const root = d3
    .hierarchy({ children: sorted.map(([name, value]) => ({ name, value })) })
    .sum((d) => d.value);

  d3.treemap().size([width, height]).padding(2).round(true)(root);

  const color = d3
    .scaleOrdinal()
    .domain(sorted.map((d) => d[0]))
    .range(d3.schemeTableau10);

  const svg = d3
    .select(container)
    .append("svg")
    .attr("width", width)
    .attr("height", height);

  const cell = svg
    .selectAll("g")
    .data(root.leaves())
    .join("g")
    .attr("class", "treemap-cell")
    .attr("transform", (d) => `translate(${d.x0},${d.y0})`);

  cell
    .append("rect")
    .attr("width", (d) => d.x1 - d.x0)
    .attr("height", (d) => d.y1 - d.y0)
    .attr("fill", (d) => color(d.data.name));

  const top5 = new Set(sorted.slice(0, 5).map((d) => d[0]));

  cell
    .filter((d) => top5.has(d.data.name))
    .append("text")
    .attr("x", 6)
    .attr("y", 18)
    .text((d) => d.data.name);
}

// ── Bootstrap ────────────────────────────────────────────────────────
loadData();
