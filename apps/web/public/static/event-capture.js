// event-capture.js
(function () {
  'use strict';

  // Simulated rrweb-like recording
  const events = [];

  function startRecording(options = {}) {
    const { clientId } = options;
    console.log('Starting recording for clientId:', clientId);

    // Record mouse clicks
    document.addEventListener('click', (event) => {
      events.push({
        type: 'click',
        x: event.clientX,
        y: event.clientY,
        timestamp: Date.now(),
        clientId,
      });
      console.log('Recorded click:', events[events.length - 1]);
    });

    // Record keypresses
    document.addEventListener('keypress', (event) => {
      events.push({
        type: 'keypress',
        key: event.key,
        timestamp: Date.now(),
        clientId,
      });
      console.log('Recorded keypress:', events[events.length - 1]);
    });

    // Expose events for external access
    window.getRecordedEvents = () => events;
  }

  window.startRecording = startRecording;
})();
