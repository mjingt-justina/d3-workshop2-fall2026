// ============================================================================
// ASSIGNMENT.JS - Race trace
// ============================================================================
// Question: who gained or lost time against the reference driver, and on which laps?
//
// A plain line chart of lap times hides this: drivers differ by tenths of a
// second per lap, while a pit stop adds about 20 seconds. Instead we plot the
// GAP to a reference driver, lap by lap:
//
//   cumulative time after lap n = sum of the driver's lap times for laps 1..n
//   gap after lap n             = driver's cumulative time - reference's cumulative time
//
// Positive gap = behind the reference. Draw "ahead" at the top.
// A pit stop shows as a drop of about 20 s; a safety car pulls the lines together.
//
// Your task: complete the TODO steps to draw one line per driver, then make it
// interactive and link it to chart 2:
//   - ONE vertical line that follows the mouse, and a tooltip with every driver's gap (STEP 9)
//   - zoom to the laps picked with the brush in chart 2 (STEP 10)
//   - highlight the line nearest to the mouse, here and in chart 2 (STEP 11 and 12)
// Refer to demo.js and participation.js for guidance.
//
// Read more:
//   Lines       https://d3js.org/d3-shape/line
//   Pointer     https://d3js.org/d3-selection/events#pointer
//   d3.median   https://d3js.org/d3-array/summarize#median
//   d3.least    https://d3js.org/d3-array/sort#least


import { onRaceChange, announce, listen } from './data.js';

let duration = 0;
const TOP_N = 10;

// STEP 1: Cumulative race times
function cumulativeTimes(race, driverNumber) {
    const laps = race.laps.filter(
        l => l.driver_number === driverNumber
    );

    const typical = d3.median(
        laps.filter(l =>
            l.lap_number !== 1 &&
            !l.pitIn &&
            l.lap_duration !== null
        ),
        l => l.lap_duration
    );

    if (typical === undefined) return [];

    let cumulative = 0;

    return laps.map(l => {
        const missing = l.lap_duration === null;
        cumulative += missing ? typical : l.lap_duration;

        return {
            lap: l.lap_number,
            cumulative,
            missing
        };
    });
}

// STEP 2: Gap to reference driver
function gapToReference(race, driverNumber, referenceNumber) {
    const refCumulative = new Map(
        cumulativeTimes(race, referenceNumber)
            .map(p => [p.lap, p.cumulative])
    );

    return cumulativeTimes(race, driverNumber)
        .filter(p => refCumulative.has(p.lap))
        .map(p => ({
            lap: p.lap,
            gap: p.cumulative - refCumulative.get(p.lap),
            missing: p.missing
        }));
}

// CHART DIMENSIONS
const margin = { top: 20, right: 60, bottom: 40, left: 60 };
const width = 900;
const height = 450;

const svg = d3.select('#chart3')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('role', 'img')
    .attr('aria-label', 'Race trace: gap to the reference driver, lap by lap');

const xAxisGroup = svg.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(0, ${height - margin.bottom})`);

const yAxisGroup = svg.append('g')
    .attr('class', 'axis')
    .attr('transform', `translate(${margin.left}, 0)`);

const zeroLine = svg.append('line')
    .attr('class', 'zero-line');

const zeroLabel = svg.append('text')
    .attr('class', 'axis-label')
    .attr('text-anchor', 'middle');

svg.append('clipPath')
    .attr('id', 'plot-area')
    .append('rect')
    .attr('x', margin.left)
    .attr('y', margin.top)
    .attr('width', width - margin.left - margin.right)
    .attr('height', height - margin.top - margin.bottom);

const linesGroup = svg.append('g')
    .attr('clip-path', 'url(#plot-area)');

const labelsGroup = svg.append('g');

const hoverLine = svg.append('line')
    .attr('class', 'hover-line')
    .attr('opacity', 0);

svg.append('text')
    .attr('class', 'axis-label')
    .attr('text-anchor', 'end')
    .attr('x', width - margin.right)
    .attr('y', height - 6)
    .text('Lap');

svg.append('text')
    .attr('class', 'axis-label')
    .attr('x', margin.left + 6)
    .attr('y', margin.top + 4)
    .text('▲ ahead');

svg.append('text')
    .attr('class', 'axis-label')
    .attr('x', margin.left + 6)
    .attr('y', height - margin.bottom - 6)
    .text('▼ behind');

const x = d3.scaleLinear()
    .range([margin.left, width - margin.right]);

const y = d3.scaleLinear()
    .range([margin.top, height - margin.bottom]);

const tooltip = d3.select('body')
    .append('div')
    .attr('class', 'tooltip')
    .attr('hidden', '');

const referenceSelect = d3.select('#reference-select');

let race = null;
let reference = null;
let series = [];
let lapRange = null;
let hoverDriver = null;

// DRAW
function draw() {
    const drivers = race.drivers.slice(0, TOP_N);
    const refName = race.drivers.find(
        d => d.driver_number === reference
    ).name_acronym;

    series = drivers.map(d => ({
        driver: d,
        values: gapToReference(
            race,
            d.driver_number,
            reference
        )
    }));

    // STEP 3: Scales
    const [firstLap, lastLap] =
        lapRange ?? [1, race.maxLap];

    const visible = v =>
        v.lap >= firstLap && v.lap <= lastLap;

    const allGaps = series.flatMap(s =>
        s.values.filter(visible).map(v => v.gap)
    );

    x.domain([firstLap, lastLap]);

    y.domain(d3.extent([...allGaps, 0])).nice();

    // STEP 4: Axes
    const xAxis = d3.axisBottom(x)
        .ticks(Math.min(10, lastLap - firstLap))
        .tickFormat(d3.format('d'));

    const yAxis = d3.axisLeft(y)
        .tickFormat(d =>
            `${d > 0 ? '+' : ''}${d} s`
        );

    xAxisGroup.transition()
        .duration(duration)
        .call(xAxis);

    yAxisGroup.transition()
        .duration(duration)
        .call(yAxis);

    // STEP 5: Zero line and reference label
    zeroLine.transition()
        .duration(duration)
        .attr('x1', margin.left)
        .attr('x2', width - margin.right)
        .attr('y1', y(0))
        .attr('y2', y(0));

    zeroLabel
        .text(`${refName} (reference)`)
        .transition()
        .duration(duration)
        .attr('x', (margin.left + width - margin.right) / 2)
        .attr('y', y(0) - 6);

    // STEP 6: Driver lines
    const line = d3.line()
        .x(d => x(d.lap))
        .y(d => y(d.gap));

    linesGroup.selectAll('path')
        .data(series, s => s.driver.driver_number)
        .join('path')
        .attr('class', 'trace-line')
        .attr('stroke', s => s.driver.color)
        .attr('stroke-dasharray', s =>
            s.driver.dash ? '6 4' : null
        )
        .transition()
        .duration(duration)
        .attr('d', s => line(s.values));

    // STEP 7: End labels
    const ends = series
        .filter(s => s.values.some(visible))
        .map(s => {
            const last = s.values.filter(visible).at(-1);

            return {
                driver: s.driver,
                lap: last.lap,
                y: y(last.gap)
            };
        })
        .sort((a, b) => a.y - b.y);

    ends.forEach((d, i) => {
        if (i > 0 && d.y < ends[i - 1].y + 14) {
            d.y = ends[i - 1].y + 14;
        }
    });

    labelsGroup.selectAll('text')
        .data(ends, d => d.driver.driver_number)
        .join('text')
        .attr('class', 'end-label')
        .attr('fill', d => d.driver.color)
        .attr('dy', '0.35em')
        .text(d => d.driver.name_acronym)
        .transition()
        .duration(duration)
        .attr('x', d => x(d.lap) + 6)
        .attr('y', d => d.y);

    // STEP 8: Animation
    duration = 750;
}

// REFERENCE DRIVER SELECTOR
referenceSelect.on('change', event => {
    reference = Number(event.target.value);
    draw();
});

onRaceChange(newRace => {
    race = newRace;
    lapRange = null;
    reference = race.drivers[0].driver_number;

    referenceSelect.selectAll('option')
        .data(race.drivers)
        .join('option')
        .attr('value', d => d.driver_number)
        .text(d => `${d.name_acronym} (${d.full_name})`);

    referenceSelect.property('value', reference);
    draw();
});

// STEP 10: Zoom linking
listen('lapRange', range => {
    lapRange = range;
    draw();
});

// STEP 11: Highlight driver
function highlight(driverNumber) {
    if (driverNumber === hoverDriver) return;

    hoverDriver = driverNumber;

    linesGroup.selectAll('path')
        .attr('opacity', s =>
            driverNumber === null ||
            s.driver.driver_number === driverNumber
                ? 1
                : 0.2
        );

    announce('hoverDriver', driverNumber);
}

// STEP 9: Hover interaction
svg.append('rect')
    .attr('x', margin.left)
    .attr('y', margin.top)
    .attr('width', width - margin.left - margin.right)
    .attr('height', height - margin.top - margin.bottom)
    .attr('fill', 'transparent')

    .on('mousemove', event => {
        const [mx, my] = d3.pointer(event);
        const [firstLap, lastLap] = x.domain();

        const lap = Math.max(
            firstLap,
            Math.min(
                lastLap,
                Math.round(x.invert(mx))
            )
        );

        hoverLine
            .attr('opacity', 1)
            .attr('x1', x(lap))
            .attr('x2', x(lap))
            .attr('y1', margin.top)
            .attr('y2', height - margin.bottom);

        const points = series
            .map(s => ({
                driver: s.driver,
                point: s.values.find(v => v.lap === lap)
            }))
            .filter(r => r.point)
            .sort((a, b) =>
                a.point.gap - b.point.gap
            );

        // STEP 11: Nearest driver
        const nearest = d3.least(
            points,
            r => Math.abs(y(r.point.gap) - my)
        );

        highlight(
            nearest ? nearest.driver.driver_number : null
        );

        const rows = points.map(r => {
            const text =
                `${r.driver.name_acronym}: ` +
                `${r.point.gap > 0 ? '+' : ''}` +
                `${r.point.gap.toFixed(1)} s` +
                `${r.point.missing ? ' (estimated)' : ''}`;

            return r === nearest
                ? `<strong>${text}</strong>`
                : text;
        });

        tooltip
            .attr('hidden', null)
            .style('left', `${event.clientX + 14}px`)
            .style('top', `${event.clientY + 14}px`)
            .html(
                `<strong>Lap ${lap}</strong><br>${rows.join('<br>')}`
            );
    })

    .on('mouseleave', () => {
        hoverLine.attr('opacity', 0);
        tooltip.attr('hidden', '');
        highlight(null);
    });

