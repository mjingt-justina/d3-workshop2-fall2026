// ============================================================================
// DEMO.JS - Track outline (we build this together in class)
// ============================================================================
// Question: what does this circuit look like?
//
// race.outline is a list of [x, y] positions of one car during one lap.
// The units are arbitrary, so we have to scale them into our SVG ourselves.
//
// Read more:
//   Scales      https://d3js.org/d3-scale/linear
//   Lines       https://d3js.org/d3-shape/line
//   Transitions https://d3js.org/d3-transition
// ============================================================================

import { onRaceChange } from './data.js';

// No animation on the first draw (page load); after that, transitions take 750 ms.
// Use .transition().duration(duration), and set duration = 750 at the end of each draw.
let duration = 0;


// ============================================================================
// SVG SETUP
// ============================================================================
// viewBox makes the SVG scale with the page, keeping its shape

const width = 600;
const height = 400;
const padding = 20;

const svg = d3.select('#chart1')
    .append('svg')
    .attr('viewBox', `0 0 ${width} ${height}`)
    .attr('role', 'img')
    .attr('aria-label', 'Track outline');

// We create the elements ONCE here, and only change their attributes when the race changes
const track = svg.append('path').attr('class', 'track');

// TODO: append a circle with class 'start-dot' (radius 7) and a text 'Start / finish'
const startDot = svg.append('circle').attr('class', 'start-dot').attr('r', 7);
const startLabel = svg.append('text').text('Start / Finish');

// TODO: we also need one more dot that will trace around the circuit when we hit play
// It should be invisible at the beginning 
const replayDot = svg.append('circle').attr('class', 'replay-dot').attr('r', 8).attr('opacity', 0)


// ============================================================================
// LINE GENERATOR
// ============================================================================
// d3.line() turns a list of [x, y] points into the "d" attribute of a <path>.

// TODO: create a line generator with a closed, smooth curve
// Hint: d3.line().curve(d3.curveCatmullRomClosed.alpha(0.5))
const line = d3.line().curve(d3.curveCatmullRomClosed.alpha(0.5))


// ============================================================================
// DRAW (runs for the first race and every time the race changes)
// ============================================================================

onRaceChange(race => {
    const points = race.outline;
    console.log('Outline points:', points.length, points.slice(0, 3));

    // TODO STEP 1: How big is the track? Use d3.extent to get [min, max] of x and of y
    
const xRange = d3.extent(points, d => d[0]);
const yRange = d3.extent(points, d => d[1]);

const trackWidth = xRange[1] - xRange[0];
const trackHeight = yRange[1] - yRange[0];



    // STEP 2: Calculate scale factor
    const k = Math.min(
        (width - 2 * padding) / trackWidth,
        (height - 2 * padding) / trackHeight
    );

    // STEP 3: Center the track
    const offsetX = (width - trackWidth * k) / 2;
    const offsetY = (height - trackHeight * k) / 2;

    // STEP 4: Build x and y scales
    const x = d3.scaleLinear()
        .domain(xRange)
        .range([offsetX, offsetX + trackWidth * k]);

    const y = d3.scaleLinear()
        .domain(yRange)
        .range([offsetY + trackHeight * k, offsetY]);

    // STEP 5: Convert points to screen positions
    const screenPoints = points.map(d => [
        x(d[0]),
        y(d[1])
    ]);

    // STEP 6: Draw the track with transition
    track.transition()
        .duration(duration)
        .attr('d', line(screenPoints));

    // STEP 7: Position start/finish dot and label
    const [startX, startY] = screenPoints[0];

    startDot.transition()
        .duration(duration)
        .attr('cx', startX)
        .attr('cy', startY);

    startLabel.transition()
        .duration(duration)
        .attr('x', startX + 12)
        .attr('y', startY - 12);

    svg.attr('aria-label', `Track outline of the ${race.label}`);

    replayDot.interrupt().attr('opacity', 0);

    duration = 750;
});

// ============================================================================
// REPLAY A LAP
// ============================================================================
// TODO: when the "Replay a lap" button (#replay) is clicked, move a dot along the path in 5 seconds.

const replayButton = d3.select('#replay');

replayButton.on('click', () => {
    const path = track.node();
    const length = path.getTotalLength();
    const start = path.getPointAtLength(0);

    // STEP 8: Put the replay dot at the start
    replayDot.interrupt()
        .attr('opacity', 1)
        .attr('cx', start.x)
        .attr('cy', start.y)
        .attr('transform', null);

    // Disable button during animation
    replayButton.property('disabled', true);

    // STEP 9: Animate the dot around the track
    replayDot.transition()
        .duration(5000)
        .ease(d3.easeLinear)
        .attrTween('transform', () => t => {
            const p = path.getPointAtLength(t * length);

            return `translate(${p.x - start.x}, ${p.y - start.y})`;
        })
        .on('end interrupt', () => {
            replayButton.property('disabled', false);
        });
});
