// Setup canvas and projection
const canvas = document.getElementById("globe");

const spaceCanvas = document.getElementById("space-bg");
const spaceCtx = spaceCanvas.getContext("2d");

let spaceWidth = window.innerWidth;
let spaceHeight = window.innerHeight;
let scrollTimeout = null;
let userIsScrolling = false;

function resizeSpaceCanvas() {
  spaceWidth = window.innerWidth;
  spaceHeight = window.innerHeight;
  spaceCanvas.width = spaceWidth;
  spaceCanvas.height = spaceHeight;
}


let stars = [];
let warpFactor = 0.25;
const WARP_IDLE = 0.25;
const WARP_CRUISE = 0.6;
const WARP_BURST = 40.0;
let warpTarget = WARP_IDLE;
let starGlobalAlpha = 1;
let starTargetAlpha = 1;
let warpTimeout = null;
let slowTimeout = null;
let fadeTimeout = null;
let lastTime = 0;
let warpHuePhase = 0;

function resetStar(star) {
  star.x = spaceWidth / 2;
  star.y = spaceHeight / 2;
  const angle = Math.random() * Math.PI * 2;
  star.vx = Math.cos(angle);
  star.vy = Math.sin(angle);
  star.baseSize = 0.7 + Math.random() * 1.4;
  star.size = star.baseSize;
  star.speed = 0.6 + Math.random() * 2.1;
  star.tw = Math.random() * Math.PI * 2;
  star.twSpeed = 0.015 + Math.random() * 0.025;
  star.hueOffset = Math.random() * 60 - 30;
  star.hue = 210;
}

function initStars() {
  stars = [];
  for (let i = 0; i < 260; i++) {
    const star = {};
    resetStar(star);
    const startDistance = Math.random() * Math.max(spaceWidth, spaceHeight);
    star.x += star.vx * startDistance;
    star.y += star.vy * startDistance;
    stars.push(star);
  }
}

function renderSpace(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const deltaTime = (timestamp - lastTime) / 16.66;
  lastTime = timestamp;

  const inStorySteps =
    isInStory && !document.body.classList.contains("cinematic-mode");

  if (inStorySteps) {
    warpFactor = 0;
    warpTarget = 0;
    starGlobalAlpha = 0;
    starTargetAlpha = 0;
    spaceCtx.clearRect(0, 0, spaceWidth, spaceHeight);
    requestAnimationFrame(renderSpace);
    return;
  }

  spaceCtx.fillStyle = "rgba(2, 6, 23, 0.9)";
  spaceCtx.fillRect(0, 0, spaceWidth, spaceHeight);

  warpFactor += (warpTarget - warpFactor) * 0.1 * deltaTime;
  starGlobalAlpha += (starTargetAlpha - starGlobalAlpha) * 0.08 * deltaTime;

  warpHuePhase += warpFactor * 0.12 * deltaTime;

  for (const star of stars) {
    star.x += star.vx * star.speed * warpFactor * deltaTime;
    star.y += star.vy * star.speed * warpFactor * deltaTime;
    star.tw += star.twSpeed * deltaTime;

    if (
      star.x < -80 ||
      star.x > spaceWidth + 80 ||
      star.y < -80 ||
      star.y > spaceHeight + 80
    ) {
      resetStar(star);
      continue;
    }

    if (warpFactor < 1.5) {
      const twinkle = 0.7 + 0.3 * Math.sin(star.tw);
      const alpha = starGlobalAlpha * twinkle;
      const coreRadius = star.size;
      const glowRadius = star.size * 2.2;

      spaceCtx.globalAlpha = alpha;
      spaceCtx.fillStyle = "#f9fafb";
      spaceCtx.beginPath();
      spaceCtx.arc(star.x, star.y, coreRadius, 0, Math.PI * 2);
      spaceCtx.fill();

      spaceCtx.globalAlpha = alpha * 0.45;
      spaceCtx.fillStyle = "#94a3b8";
      spaceCtx.beginPath();
      spaceCtx.arc(star.x, star.y, glowRadius, 0, Math.PI * 2);
      spaceCtx.fill();
    } else {
      const warpIntensity = Math.min(warpFactor, 10);
      const trailLength = warpIntensity * star.speed * 0.9;
      const tailX = star.x - star.vx * trailLength;
      const tailY = star.y - star.vy * trailLength;

      const baseHue = 220 + 80 * Math.sin(warpHuePhase * 0.5);
      const hue = (baseHue + star.hueOffset + 360) % 360;
      const lightness = 55 + Math.min(warpIntensity, 5) * 7;

      spaceCtx.globalAlpha = starGlobalAlpha;
      spaceCtx.lineCap = "round";
      spaceCtx.strokeStyle = `hsl(${hue}, 80%, ${lightness}%)`;
      spaceCtx.lineWidth = star.size * (0.7 + warpIntensity * 0.04);

      spaceCtx.beginPath();
      spaceCtx.moveTo(tailX, tailY);
      spaceCtx.lineTo(star.x, star.y);
      spaceCtx.stroke();
    }

    spaceCtx.globalAlpha = 1;
  }
  if (!isWarping && document.body.classList.contains("cinematic-mode")) {
    if (warpFactor < 0.3) {
      warpTarget = 0.0; // no more motion
      starTargetAlpha += (0 - starTargetAlpha) * 0.03 * deltaTime;
    }
  }
  requestAnimationFrame(renderSpace);
}

resizeSpaceCanvas();
initStars();
requestAnimationFrame(renderSpace);
window.addEventListener("resize", resizeSpaceCanvas);


const context = canvas.getContext("2d");
const container = document.querySelector(".left-panel");

function setProjection(scale, width, height) {
  projection = d3
    .geoOrthographic()
    .clipAngle(90)
    .rotate([-80, -10])
    .scale(scale)
    .translate([width / 2, height / 2]);

  path = d3.geoPath().projection(projection).context(context);
}

let projection = d3.geoOrthographic().clipAngle(90).rotate([-80, -10]);
let path = d3.geoPath().projection(projection).context(context);
const sphere = { type: "Sphere" };
const graticule = d3.geoGraticule10();

let countries;
let plotData = [];
let targetScale = 250;

let isEarthVisible = true;
let isInStory = false;
let isWarping = false;
let isZooming = false;
let dotAlpha = 1.0;

function resizeCanvas() {
  const rect = container.getBoundingClientRect();
  const width = rect.width;
  const height = rect.height;

  canvas.width = width;
  canvas.height = height;

  targetScale = Math.min(width, height) / 2.2;

  setProjection(targetScale, width, height);
  draw();
}

function draw() {
  context.clearRect(0, 0, canvas.width, canvas.height);
  const inCinematic = document.body.classList.contains("cinematic-mode");

  if (!isEarthVisible) return;

  if (isZooming) {
    if (countries) {
      const t = projection.translate();
      const cx = t[0];
      const cy = t[1];
      const r = projection.scale();

      context.beginPath();
      context.arc(cx, cy, r, 0, Math.PI * 2);
      context.fillStyle = colorScale(CO2_MIN);
      context.fill();

      if (inCinematic) {
        context.fillStyle = "rgba(15, 23, 42, 1)";
        context.strokeStyle = "rgba(255, 255, 255, 0.95)";
        context.lineWidth = 1.2;
      } else {
        context.fillStyle = "#ffffff08";
        context.strokeStyle = "#000";
        context.lineWidth = 0.6;
      }

      context.beginPath();
      path(countries);
      context.fill();
      context.stroke();
    }

    return;
  }

  if (plotData.length && isEarthVisible) {
    const t = projection.translate();
    const cx = t[0];
    const cy = t[1];
    const r = projection.scale() - 3;

    plotData.forEach((d) => {
      const coords = projection([d.lon, d.lat]);
      if (!coords) return;
      const x = coords[0];
      const y = coords[1];
      const dx = x - cx;
      const dy = y - cy;
      if (dx * dx + dy * dy > r * r) return;

      context.fillStyle = colorScale(d.co2);
      context.fillRect(x - 3, y - 3, 6, 6);
    });
  }

  if (countries) {
    if (inCinematic) {
      context.fillStyle = "rgba(15, 23, 42, 1)";
      context.strokeStyle = "rgba(255, 255, 255, 0.95)";
      context.lineWidth = 1.2;
    } else {
      context.fillStyle = "#ffffff08";
      context.strokeStyle = "#000";
      context.lineWidth = 0.6;
    }

    context.beginPath();
    path(countries);
    context.fill();
    context.stroke();
  }
}

window.addEventListener("resize", resizeCanvas);

const CO2_MIN = 0.0;
const CO2_MID = 3.01215e-8;
const CO2_MAX = 6.0243e-8;

const colorScale = d3
  .scaleLinear()
  .domain([CO2_MIN, CO2_MID, CO2_MAX])
  .range(["green", "yellow", "red"]);

function updateYear(csvFile) {
  d3.csv(csvFile).then((data) => {
    const yearData = data.map((d) => ({
      lat: +d.lat,
      lon: +d.lon,
      co2: +d.fco2antt,
    }));

    const binnedData = d3.rollup(
      yearData,
      (v) => d3.mean(v, (d) => d.co2),
      (d) => Math.round(d.lat),
      (d) => Math.round(d.lon)
    );

    plotData = [];
    binnedData.forEach((lons, lat) => {
      lons.forEach((co2, lon) => {
        plotData.push({ lat: +lat, lon: +lon, co2 });
      });
    });

    draw();
  });
}

function drawRegionChart(regionName, chartDiv, data, eventYear) {
  chartDiv.innerHTML = "";

  const parsedData = data.map((d) => ({
    time: +d.time,
    date: new Date(+d.time, 0, 1),
    value: +d[regionName],
  }));

  const margin = { top: 20, right: 30, bottom: 30, left: 50 };
  const width = chartDiv.clientWidth - margin.left - margin.right;
  const height = chartDiv.clientHeight - margin.top - margin.bottom;

  const svg = d3
    .select(chartDiv)
    .append("svg")
    .attr("width", width + margin.left + margin.right)
    .attr("height", height + margin.top + margin.bottom)
    .append("g")
    .attr("transform", `translate(${margin.left},${margin.top})`);

  const x = d3
    .scaleTime()
    .domain(d3.extent(parsedData, (d) => d.date))
    .range([0, width]);

  const y = d3
    .scaleLinear()
    .domain([0, d3.max(parsedData, (d) => d.value)])
    .range([height, 0]);

  const yAxis = d3.axisLeft(y).tickFormat(d3.format(".2e"));
  const xAxis = d3.axisBottom(x);

  svg.append("g").call(yAxis);
  svg.append("g").attr("transform", `translate(0,${height})`).call(xAxis);

  const line = d3
    .line()
    .x((d) => x(d.date))
    .y((d) => y(d.value));

  const preEvent = parsedData.filter((d) => d.time <= eventYear);
  const postEvent = parsedData.filter((d) => d.time >= eventYear);

  svg
    .append("path")
    .datum(preEvent)
    .attr("fill", "none")
    .attr("stroke", "blue")
    .attr("stroke-width", 2)
    .attr("d", line);

  svg
    .append("path")
    .datum(postEvent)
    .attr("fill", "none")
    .attr("stroke", "red")
    .attr("stroke-width", 2)
    .attr("d", line);

  svg
    .append("text")
    .attr("x", width / 2)
    .attr("y", -5)
    .attr("text-anchor", "middle")
    .text(regionName);
}

d3.json("data/countries.json").then((world) => {
  countries = topojson.feature(world, world.objects.countries);
  resizeCanvas();
  draw();

  const firstDataStep = document.querySelector(".step[data-globe-file]");
  if (firstDataStep) {
    const initialCsv = firstDataStep.dataset.globeFile;
    updateYear(initialCsv);
  }

  const scroller = scrollama();
  scroller.setup({ step: ".step" }).onStepEnter(async ({ element }) => {
    const stepType = element.dataset.stepType;
    if (stepType === "landing") {
      document.body.classList.add("cinematic-mode");

      isEarthVisible = true;
      resizeCanvas();
      return;
    }
    if (stepType === "approach") {
      document.body.classList.add("cinematic-mode");
      isEarthVisible = true;
      draw();
      return;
    }

    document.body.classList.remove("cinematic-mode");
    resizeCanvas();
    isEarthVisible = true;

    warpTarget = 0;
    warpFactor = 0;
    starTargetAlpha = 0;
    starGlobalAlpha = 0;

    const globeFile = element.dataset.globeFile;
    const chartFile = element.dataset.chartFile;
    const region = element.dataset.region;
    const year = +element.dataset.year;

    setProjection(targetScale, canvas.width, canvas.height);

    updateYear(globeFile);


    const chartData = await d3.csv(chartFile);
    const block = element.closest(".step-block");
    const chartDiv = block.querySelector(".chart");
    drawRegionChart(region, chartDiv, chartData, year);
  });
});

const intro = document.querySelector(".intro");
const scrolly = document.getElementById("scrolly");

function clearWarpTimers() {
  if (warpTimeout) {
    clearTimeout(warpTimeout);
    warpTimeout = null;
  }
  if (slowTimeout) {
    clearTimeout(slowTimeout);
    slowTimeout = null;
  }
  if (fadeTimeout) {
    clearTimeout(fadeTimeout);
    fadeTimeout = null;
  }
}

function enterStory() {
  if (isInStory || isWarping) return;
  isInStory = true;
  isWarping = true;
  clearWarpTimers();

  scrolly.classList.add("visible");
  intro.classList.add("slide-up");

  document.body.classList.add("cinematic-mode");
  resizeCanvas();

  const scrollyTop = scrolly.offsetTop;
  window.scrollTo({
    top: scrollyTop,
    behavior: "auto",
  });

  initStars();
  warpFactor = WARP_IDLE;
  starGlobalAlpha = 1;
  starTargetAlpha = 1;

  isEarthVisible = false;
  draw();

  warpTarget = WARP_BURST;
  const WARP_DURATION = 1300;
  const DECEL_DURATION = 700;
  const ZOOM_DURATION = 1200;

  warpTimeout = setTimeout(() => {
    warpTarget = WARP_CRUISE;

    slowTimeout = setTimeout(() => {
      warpTarget = 0.05;
      starTargetAlpha = 0.3;

      isEarthVisible = true;
      dotAlpha = 0;
      isZooming = true;

      const startScale = targetScale * 0.12;
      const endScale = targetScale * 0.9;

      projection.scale(startScale);
      draw();

      d3.transition()
        .duration(ZOOM_DURATION)
        .ease(d3.easeCubicInOut)
        .tween("zoom-in", () => {
          const interpScale = d3.interpolate(startScale, endScale);
          return (t) => {
            projection.scale(interpScale(t));
            draw();
          };
        })
        .on("end", () => {
          isZooming = false;
          draw();

          warpTarget = WARP_IDLE;
          starTargetAlpha = 1;
          isWarping = false;

          fadeTimeout = setTimeout(() => {
            if (!isWarping) {
              warpTarget = 0.0;
              starTargetAlpha = 0.0;
            }
            fadeTimeout = null;
          }, 1000);
        });

    }, DECEL_DURATION);
  }, WARP_DURATION);
}


function leaveStory() {
  if (isWarping) return;

  isInStory = false;
  clearWarpTimers();
  warpTarget = WARP_IDLE;
  starTargetAlpha = 1;
  starGlobalAlpha = 1;
  isEarthVisible = true;

  scrolly.classList.remove("visible");
  intro.classList.remove("slide-up");

  document.body.classList.remove("cinematic-mode");
  resizeCanvas();
  draw();
}


const transitionObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) {
        enterStory();
      } else {
        leaveStory();
      }
    });
  },
  { threshold: 0.2 }
);

transitionObserver.observe(intro);


