ymaps.modules.define('ext.paintOnMap', ['meta', 'util.extend', 'pane.EventsPane', 'Event'], function (provide, meta, extend, EventsPane, Event) {
    'use strict';

    const EVENTS_PANE_ZINDEX = 500;
    const DEFAULT_UNWANTED_BEHAVIORS = ['drag', 'scrollZoom'];
    const DEFAULT_STYLE = { strokeColor: '#000000', strokeWidth: 1, strokeOpacity: 1 };
    const DEFAULT_TOLERANCE = 16;

    const badFinishPaintingCall = function () {
        throw new Error('(ymaps.ext.paintOnMap) некорректный вызов PaintingProcess#finishPaintingAt. Рисование уже завершено.');
    };

    function paintOnMap(map, positionOrEvent, config) {
        config = config || {};
        const style = extend(DEFAULT_STYLE, config.style || {});
        const unwantedBehaviors = config.unwantedBehaviors === undefined ? DEFAULT_UNWANTED_BEHAVIORS : config.unwantedBehaviors;

        const pane = new EventsPane(map, {
            css: { position: 'absolute', width: '100%', height: '100%' },
            zIndex: EVENTS_PANE_ZINDEX + 50,
            transparent: true,
        });

        map.panes.append('ext-paint-on-map', pane);

        if (unwantedBehaviors) {
            map.behaviors.disable(unwantedBehaviors);
        }

        const canvas = document.createElement('canvas');
        const ctx2d = canvas.getContext('2d');
        const rect = map.container.getParentElement().getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;

        ctx2d.globalAlpha = style.strokeOpacity;
        ctx2d.strokeStyle = style.strokeColor;
        ctx2d.lineWidth = style.strokeWidth;

        canvas.style.width = '100%';
        canvas.style.height = '100%';

        pane.getElement().appendChild(canvas);

        const firstPosition = positionOrEvent ? toPosition(positionOrEvent) : null;
        let coordinates = firstPosition ? [firstPosition] : [];

        const bounds = map.getBounds();
        const latDiff = bounds[1][0] - bounds[0][0];
        const lonDiff = bounds[1][1] - bounds[0][1];

        canvas.onmousemove = function (e) {
            coordinates.push([e.offsetX, e.offsetY]);

            ctx2d.clearRect(0, 0, canvas.width, canvas.height);
            ctx2d.beginPath();

            ctx2d.moveTo(coordinates[0][0], coordinates[0][1]);
            for (let i = 1; i < coordinates.length; i++) {
                ctx2d.lineTo(coordinates[i][0], coordinates[i][1]);
            }

            ctx2d.stroke();
        };

        const paintingProcess = {
            finishPaintingAt: function (positionOrEvent) {
                paintingProcess.finishPaintingAt = badFinishPaintingCall;

                if (positionOrEvent) {
                    coordinates.push(toPosition(positionOrEvent));
                }

                map.panes.remove(pane);
                if (unwantedBehaviors) {
                    map.behaviors.enable(unwantedBehaviors);
                }

                const tolerance = config.tolerance === undefined ? DEFAULT_TOLERANCE : Number(config.tolerance);
                if (tolerance) {
                    coordinates = simplify(coordinates, tolerance);
                }

                return coordinates.map(function (x) {
                    const lon = bounds[0][1] + (x[0] / canvas.width) * lonDiff;
                    const lat = bounds[0][0] + (1 - x[1] / canvas.height) * latDiff;

                    return meta.coordinatesOrder === 'latlong' ? [lat, lon] : [lon, lat];
                });
            },
        };

        return paintingProcess;
    }

    function toPosition(positionOrEvent) {
        return positionOrEvent instanceof Event ? [positionOrEvent.get('offsetX'), positionOrEvent.get('offsetY')] : positionOrEvent;
    }

    function simplify(coordinates, tolerance) {
        const toleranceSquared = tolerance * tolerance;
        const simplified = [coordinates[0]];

        let prev = coordinates[0];
        for (let i = 1; i < coordinates.length; i++) {
            const curr = coordinates[i];
            if (Math.pow(prev[0] - curr[0], 2) + Math.pow(prev[1] - curr[1], 2) > toleranceSquared) {
                simplified.push(curr);
                prev = curr;
            }
        }
        return simplified;
    }

    provide(paintOnMap);
});
