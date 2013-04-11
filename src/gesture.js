/*global Zepto*/
(function ($) {
  function parentIfText(node) {
    return 'tagName' in node ? node : node.parentNode;
  }

  function copy(target, source) {
    var properties = ["screenX", "screenY", "clientX", "clientY", "pageX", "pageY"];
    properties.forEach(function (p) {
      target[p] = source[p];
    });
    return target;
  }

  var gestures = {};
  var el;
  $(document).ready(function () {
    var body = $(document.body);
    function start(event) {
      if (Object.getOwnPropertyNames(gestures).length === 0) {
        body.bind("touchmove", move);
        body.bind("touchend", end);
        el = $(parentIfText(event.touches[0].target));
      }

      [].forEach.call(event.changedTouches, function (touch) {
        var touchRecord = {};
        for (var p in touch) {
          touchRecord[p] = touch[p];
        }
        var gesture = {
          startTouch: touchRecord,
          startTime: Date.now(),
          status: "tapping",
          pressingHandler: setTimeout(function () {
            if (gesture.status === "tapping") {
              gesture.status = "pressing";
              el.trigger(copy($.Event('press'), touchRecord));
            }
            gesture.pressingHandler = null;
          }, 500)
        };
        gestures[touch.identifier] = gesture;
      });

      if (Object.getOwnPropertyNames(gestures).length === 2) {
        var ev = $.Event('dualtouchstart');
        ev.touches = event.touches;
        el.trigger(ev);
      }
    }

    function move(event) {
      [].forEach.call(event.changedTouches, function (touch) {
        var gesture = gestures[touch.identifier];
        if (!gesture) {
          return;
        }
        var startTouch = gesture.startTouch;
        var offsetX = touch.clientX - startTouch.clientX;
        var offsetY = touch.clientY - startTouch.clientY;
        var distance = Math.sqrt(Math.pow(offsetX, 2) + Math.pow(offsetY, 2));

        var ev;
        // magic number 10: moving 10px means pan, not tap
        if (gesture.status === "tapping") {
          if (distance > 10) {
            gesture.status = "panning";
            el.trigger(copy($.Event('panstart'), touch));
          }
        } else if (gesture.status === "panning") {
          ev = $.Event('pan');
          ev.offsetX = offsetX;
          ev.offsetY = offsetY;
          el.trigger(copy(ev, touch));
        }
      });

      if (Object.getOwnPropertyNames(gestures).length === 2) {
        var position = [];
        var current = [];
        for (var i = 0; i < event.touches.length; i++) {
          var touch = event.touches[i];
          if (gestures[touch.identifier]) {
            var startTouch = gestures[touch.identifier].startTouch;
            position.push([startTouch.clientX, startTouch.clientY]);
            current.push([touch.clientX, touch.clientY]);
          }
        }

        var transform = (function (x1, y1, x2, y2, x3, y3, x4, y4) {
          var rotate = Math.atan2(y4 - y3, x4 - x3) - Math.atan2(y2 - y1, x2 - x1);
          var scale = Math.sqrt((Math.pow(y4 - y3, 2) + Math.pow(x4 - x3, 2)) / (Math.pow(y2 - y1, 2) + Math.pow(x2 - x1, 2)));
          var translate = [x3 - scale * x1 * Math.cos(rotate) + scale * y1 * Math.sin(rotate), y3 - scale * y1 * Math.cos(rotate) - scale * x1 * Math.sin(rotate)];

          return {
            rotate: rotate,
            scale: scale,
            translate: translate,
            matrix: [
              [scale * Math.cos(rotate), -scale * Math.sin(rotate), translate[0]],
              [scale * Math.sin(rotate), scale * Math.cos(rotate), translate[1]],
              [0, 0, 1]
            ]
          };
        }(position[0][0], position[0][1], position[1][0], position[1][1], current[0][0], current[0][1], current[1][0], current[1][1]));
        var ev = $.Event('dualtouch');
        ev.rotate = transform.rotate;
        ev.scale = transform.scale;
        ev.translate = transform.translate;
        ev.matrix = transform.matrix;
        ev.touches = event.touches;
        el.trigger(ev);
      }
    }

    function end(event) {
      var ev;
      if (Object.getOwnPropertyNames(gestures).length === 2) {
        ev = $.Event('dualtouchend');
        ev.touches = event.touches;
        el.trigger(ev);
      }
      [].forEach.call(event.changedTouches, function (touch) {
        var gesture = gestures[touch.identifier];
        if (!gesture) {
          return;
        }

        if (gesture.pressingHandler) {
          clearTimeout(gesture.pressingHandler);
          gesture.pressingHandler = null;
        }

        if (gesture.status === "tapping") {
          el.trigger(copy($.Event('tap'), touch));
        }
        if (gesture.status === "panning") {
          el.trigger(copy($.Event('panend'), touch));

          var duration = Date.now() - gesture.startTime;
          if (duration < 300) {
            ev = $.Event('flick');
            ev.duration = duration;
            var startTouch = gesture.startTouch;
            ev.speedX = (touch.clientX - startTouch.clientX) / duration;
            ev.speedY = (touch.clientY - startTouch.clientY) / duration;
            ev.offsetX = touch.clientX - startTouch.clientX;
            ev.offsetY = touch.clientY - startTouch.clientY;
            el.trigger(copy(ev, touch));
          }
        }

        if (gesture.status === "pressing") {
          el.trigger(copy($.Event('pressend'), touch));
        }
        delete gestures[touch.identifier];
      });

      if (Object.getOwnPropertyNames(gestures).length === 0) {
        body.unbind("touchend", end).unbind("touchmove", move);
      }
    }

    //double tap
    var lastTapTime = NaN;

    body.bind("tap", function (event) {
      var now = Date.now();
      if (now - lastTapTime < 500) {
        el.trigger(copy($.Event('doubletap'), event));
      }
      lastTapTime = now;
    }, false);

    body.bind('touchstart', start);
  });
}(Zepto));
