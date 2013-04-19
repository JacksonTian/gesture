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
            clearTimeout(gesture.pressingHandler);
            gesture.pressingHandler = null;
          }, 200)
        };
        gestures[touch.identifier] = gesture;
      });
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

        var ev;
        if (gesture.status === "pressing") {
          gesture.status = "tapping";
        }
        // magic number 10: moving 10px means pan, not tap
        if (gesture.status === "tapping") {
          var distance = Math.sqrt(Math.pow(offsetX, 2) + Math.pow(offsetY, 2));
          if (distance > 10) {
            gesture.status = "panning";
            ev = $.Event('panstart');
            ev.offsetX = offsetX;
            ev.offsetY = offsetY;
            el.trigger(copy(ev, touch));
          }
        } else if (gesture.status === "panning") {
          ev = $.Event('pan');
          ev.offsetX = offsetX;
          ev.offsetY = offsetY;
          el.trigger(copy(ev, touch));
        }
      });
    }

    function end(event) {
      var ev;
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
          ev = $.Event('panend');
          var startTouch = gesture.startTouch;
          var offsetX = touch.clientX - startTouch.clientX;
          var offsetY = touch.clientY - startTouch.clientY;
          var duration = Date.now() - gesture.startTime;
          ev.duration = duration;
          ev.offsetX = offsetX;
          ev.offsetY = offsetY;
          el.trigger(copy(ev, touch));

          if (duration < 300) {
            ev = $.Event('flick');
            ev.duration = duration;
            ev.offsetX = offsetX;
            ev.offsetY = offsetY;
            ev.speedX = offsetX / duration;
            ev.speedY = offsetY / duration;
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
