/* DingProof — client-side rental car inspection report.
   No network calls, no storage, nothing leaves the device. */
(function () {
  'use strict';

  /* ---------------------------------------------------------------
     Config
  --------------------------------------------------------------- */

  var MAX_EDGE = 1200;      // longest side of a stored photo, in pixels
  var JPEG_QUALITY = 0.72;

  var SHOTS = [
    { key: 'front',        name: 'Front',                    how: 'Stand in front of the car. Fit the whole front in the photo.' },
    { key: 'front_right',  name: 'Front right corner',       how: 'Step to the right corner. Show the bumper and the wing together.' },
    { key: 'right',        name: 'Right side',               how: 'Whole right side, both wheels in the picture.' },
    { key: 'rear_right',   name: 'Rear right corner',        how: 'Show the rear bumper and the right wing.' },
    { key: 'rear',         name: 'Rear',                     how: 'Stand behind the car. Include the plate and both lights.' },
    { key: 'rear_left',    name: 'Rear left corner',         how: 'Show the rear bumper and the left wing.' },
    { key: 'left',         name: 'Left side',                how: 'Whole left side, both wheels in the picture.' },
    { key: 'extras',       name: 'Roof, glass, inside, odometer', how: 'One photo of the roof and windscreen, plus the dashboard showing the kilometres.' }
  ];

  var DAMAGE_TYPES = [
    'Scratch', 'Dent', 'Wheel scuff', 'Chip or crack',
    'Missing part', 'Stain or tear', 'Other'
  ];

  /* ---------------------------------------------------------------
     State — memory only. Never localStorage / sessionStorage.
  --------------------------------------------------------------- */

  var state = {
    step: 1,
    photos: {},        // key -> { dataUrl, width, height, takenAt }
    marks: [],         // { id, x, y, type, note, at }
    geo: null,         // { lat, lon, accuracy, at }
    geoAsked: false,
    pendingPoint: null,
    pendingType: null,
    pendingPhoto: null
  };

  var uid = 0;
  function nextId() { uid += 1; return uid; }

  /* ---------------------------------------------------------------
     Helpers
  --------------------------------------------------------------- */

  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  // { local: "29/08/2026, 14:03:22", iso: "2026-08-29T11:03:22Z" }
  function stamp(date) {
    var d = date || new Date();
    var local;
    try {
      local = d.toLocaleString();
    } catch (e) {
      local = d.toString();
    }
    return { local: local, iso: d.toISOString().replace(/\.\d{3}Z$/, 'Z'), date: d };
  }

  function stampText(s) { return s.local + '  (' + s.iso + ' UTC)'; }

  function fileDateStr(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function trip() {
    var phaseEl = document.querySelector('input[name="phase"]:checked');
    return {
      company: $('#company').value.trim(),
      plate: $('#plate').value.trim().toUpperCase(),
      model: $('#model').value.trim(),
      odometer: $('#odometer').value.trim(),
      fuel: $('#fuel').value,
      phase: phaseEl ? phaseEl.value : 'Pickup'
    };
  }

  function photoCount() { return Object.keys(state.photos).length; }

  function markPhotoCount() {
    return state.marks.filter(function (m) { return !!m.photo; }).length;
  }

  function hasData() {
    return photoCount() > 0 || state.marks.length > 0;
  }

  function safePlate(plate) {
    var p = (plate || '').replace(/[^A-Za-z0-9]/g, '');
    return p || 'NOPLATE';
  }

  /* ---------------------------------------------------------------
     Step navigation
  --------------------------------------------------------------- */

  function goto(step) {
    state.step = step;
    var panels = document.querySelectorAll('.step');
    for (var i = 0; i < panels.length; i++) {
      var n = Number(panels[i].getAttribute('data-step'));
      panels[i].classList.toggle('is-hidden', n !== step);
    }
    var tabs = document.querySelectorAll('.step-tab');
    for (var j = 0; j < tabs.length; j++) {
      var t = Number(tabs[j].getAttribute('data-goto'));
      tabs[j].classList.toggle('is-active', t === step);
      tabs[j].classList.toggle('is-done', t < step);
      if (t === step) { tabs[j].setAttribute('aria-current', 'step'); }
      else { tabs[j].removeAttribute('aria-current'); }
    }
    $('#progressBar').style.width = (step * 25) + '%';
    if (step === 4) { renderSummary(); }
    window.scrollTo(0, 0);
  }

  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest ? ev.target.closest('[data-goto]') : null;
    if (btn) { goto(Number(btn.getAttribute('data-goto'))); }
  });

  /* ---------------------------------------------------------------
     Step 2 — photos
  --------------------------------------------------------------- */

  function buildShotList() {
    var list = $('#shotList');
    list.innerHTML = '';
    SHOTS.forEach(function (shot, i) {
      var li = document.createElement('li');
      li.className = 'shot';
      li.id = 'shot-' + shot.key;

      var idx = document.createElement('span');
      idx.className = 'shot-index mono';
      idx.textContent = String(i + 1);

      var main = document.createElement('div');
      main.className = 'shot-main';

      var title = document.createElement('p');
      title.className = 'shot-title';
      title.textContent = shot.name;
      var how = document.createElement('p');
      how.className = 'shot-how';
      how.textContent = shot.how;

      var foot = document.createElement('div');
      foot.className = 'shot-foot';

      var img = document.createElement('img');
      img.className = 'shot-thumb is-hidden';
      img.alt = '';

      var time = document.createElement('p');
      time.className = 'shot-time mono is-hidden';

      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.setAttribute('capture', 'environment');
      input.id = 'file-' + shot.key;

      var label = document.createElement('label');
      label.className = 'shot-cta';
      label.setAttribute('for', input.id);
      label.textContent = 'Take photo';

      foot.appendChild(img);
      foot.appendChild(time);
      foot.appendChild(input);
      foot.appendChild(label);

      main.appendChild(title);
      main.appendChild(how);
      main.appendChild(foot);

      input.addEventListener('change', function () {
        if (!input.files || !input.files[0]) { return; }
        label.textContent = 'Working\u2026';
        shrinkImage(input.files[0], function (err, result) {
          input.value = '';
          if (err) {
            label.textContent = 'Try again';
            alert('That photo could not be read. Please take it again.');
            return;
          }
          result.takenAt = stamp();
          state.photos[shot.key] = result;
          renderShot(shot, li, img, label, time);
          updateShotCount();
        });
      });

      li.appendChild(idx);
      li.appendChild(main);
      list.appendChild(li);
    });
  }

  function renderShot(shot, li, img, label, time) {
    var p = state.photos[shot.key];
    li.classList.add('is-done');
    img.src = p.dataUrl;
    img.classList.remove('is-hidden');
    label.textContent = 'Retake';
    time.textContent = p.takenAt.local;
    time.classList.remove('is-hidden');
  }

  function updateShotCount() {
    $('#shotCount').textContent = photoCount() + ' / ' + SHOTS.length;
  }

  // Resize with canvas so the PDF stays small. Returns a JPEG data URL.
  function shrinkImage(file, done) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      try {
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        var scale = Math.min(1, MAX_EDGE / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * scale));
        var ch = Math.max(1, Math.round(h * scale));

        var canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);

        var dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        URL.revokeObjectURL(url);
        done(null, { dataUrl: dataUrl, width: cw, height: ch });
      } catch (e) {
        URL.revokeObjectURL(url);
        done(e);
      }
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      done(new Error('decode failed'));
    };
    img.src = url;
  }

  /* ---------------------------------------------------------------
     Step 3 — damage diagram
  --------------------------------------------------------------- */

  var svg = $('#carSvg');

  // Screen coordinates -> SVG user coordinates, correct at any screen size.
  function toSvgPoint(clientX, clientY) {
    var pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    var ctm = svg.getScreenCTM();
    if (!ctm) { return null; }
    var local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }

  svg.addEventListener('click', function (ev) {
    var p = toSvgPoint(ev.clientX, ev.clientY);
    if (p) { openMarkModal(p); }
  });

  // Keyboard users: Enter or Space drops a mark in the middle of the car.
  svg.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      openMarkModal({ x: 160, y: 310 });
    }
  });

  function buildTypeGrid() {
    var grid = $('#typeGrid');
    grid.innerHTML = '';
    DAMAGE_TYPES.forEach(function (type) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'type-btn';
      b.textContent = type;
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', 'false');
      b.addEventListener('click', function () {
        state.pendingType = type;
        var all = grid.querySelectorAll('.type-btn');
        for (var i = 0; i < all.length; i++) {
          var on = all[i] === b;
          all[i].classList.toggle('is-picked', on);
          all[i].setAttribute('aria-checked', on ? 'true' : 'false');
        }
      });
      grid.appendChild(b);
    });
  }

  var lastFocused = null;

  // Close-up photo attached to the mark being added.
  function showPendingPhoto() {
    var thumb = $('#markPhotoThumb');
    var rm = $('#markPhotoRemove');
    var btn = $('#markPhotoBtn');
    if (state.pendingPhoto) {
      thumb.src = state.pendingPhoto.dataUrl;
      thumb.classList.remove('is-hidden');
      rm.classList.remove('is-hidden');
      btn.textContent = 'Retake close-up';
    } else {
      thumb.removeAttribute('src');
      thumb.classList.add('is-hidden');
      rm.classList.add('is-hidden');
      btn.textContent = 'Take close-up';
    }
  }

  $('#markPhotoInput').addEventListener('change', function () {
    var input = $('#markPhotoInput');
    if (!input.files || !input.files[0]) { return; }
    $('#markPhotoBtn').textContent = 'Working\u2026';
    shrinkImage(input.files[0], function (err, result) {
      input.value = '';
      if (err) {
        showPendingPhoto();
        alert('That photo could not be read. Please take it again.');
        return;
      }
      result.takenAt = stamp();
      state.pendingPhoto = result;
      showPendingPhoto();
    });
  });

  $('#markPhotoRemove').addEventListener('click', function () {
    state.pendingPhoto = null;
    showPendingPhoto();
  });


  function openMarkModal(point) {
    state.pendingPoint = point;
    state.pendingType = DAMAGE_TYPES[0];
    state.pendingPhoto = null;
    lastFocused = document.activeElement;

    var btns = $('#typeGrid').querySelectorAll('.type-btn');
    for (var i = 0; i < btns.length; i++) {
      var on = i === 0;
      btns[i].classList.toggle('is-picked', on);
      btns[i].setAttribute('aria-checked', on ? 'true' : 'false');
    }
    $('#markNote').value = '';
    showPendingPhoto();
    $('#markModal').classList.remove('is-hidden');
    btns[0].focus();
  }

  function closeMarkModal() {
    $('#markModal').classList.add('is-hidden');
    state.pendingPoint = null;
    state.pendingPhoto = null;
    if (lastFocused && lastFocused.focus) { lastFocused.focus(); }
  }

  $('#markCancel').addEventListener('click', closeMarkModal);

  $('#markModal').addEventListener('click', function (ev) {
    if (ev.target === $('#markModal')) { closeMarkModal(); }
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && !$('#markModal').classList.contains('is-hidden')) {
      closeMarkModal();
    }
  });

  $('#markSave').addEventListener('click', function () {
    if (!state.pendingPoint) { return; }
    state.marks.push({
      id: nextId(),
      x: state.pendingPoint.x,
      y: state.pendingPoint.y,
      type: state.pendingType || DAMAGE_TYPES[0],
      note: $('#markNote').value.trim(),
      photo: state.pendingPhoto,
      at: stamp()
    });
    closeMarkModal();
    renderMarks();
  });

  var SVGNS = 'http://www.w3.org/2000/svg';

  function renderMarks() {
    var layer = $('#pinLayer');
    while (layer.firstChild) { layer.removeChild(layer.firstChild); }

    state.marks.forEach(function (m, i) {
      var g = document.createElementNS(SVGNS, 'g');
      g.setAttribute('class', 'pin');
      var c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('cx', m.x);
      c.setAttribute('cy', m.y);
      c.setAttribute('r', '13');
      var t = document.createElementNS(SVGNS, 'text');
      t.setAttribute('x', m.x);
      t.setAttribute('y', m.y);
      t.textContent = String(i + 1);
      g.appendChild(c);
      g.appendChild(t);
      layer.appendChild(g);
    });

    var list = $('#markList');
    list.innerHTML = '';
    state.marks.forEach(function (m, i) {
      var li = document.createElement('li');
      li.className = 'mark';

      var num = document.createElement('span');
      num.className = 'mark-num mono';
      num.textContent = String(i + 1);

      var body = document.createElement('div');
      body.className = 'mark-body';
      var type = document.createElement('p');
      type.className = 'mark-type';
      type.textContent = m.type;
      body.appendChild(type);
      if (m.note) {
        var note = document.createElement('p');
        note.className = 'mark-note';
        note.textContent = m.note;
        body.appendChild(note);
      }
      var time = document.createElement('p');
      time.className = 'mark-time mono';
      time.textContent = m.at.local;
      body.appendChild(time);

      // Close-up photo for this mark: add one, or replace the one that is there.
      var shot = document.createElement('div');
      shot.className = 'mark-shot';

      var shotImg = document.createElement('img');
      shotImg.className = 'mark-shot-thumb';
      shotImg.alt = '';
      if (m.photo) { shotImg.src = m.photo.dataUrl; } else { shotImg.className += ' is-hidden'; }

      var shotInput = document.createElement('input');
      shotInput.type = 'file';
      shotInput.accept = 'image/*';
      shotInput.setAttribute('capture', 'environment');
      shotInput.id = 'markshot-' + m.id;

      var shotLabel = document.createElement('label');
      shotLabel.className = 'mark-shot-cta';
      shotLabel.setAttribute('for', shotInput.id);
      shotLabel.textContent = m.photo ? 'Replace' : 'Add close-up photo';

      shotInput.addEventListener('change', function () {
        if (!shotInput.files || !shotInput.files[0]) { return; }
        shotLabel.textContent = 'Working\u2026';
        shrinkImage(shotInput.files[0], function (err, result) {
          shotInput.value = '';
          if (err) {
            shotLabel.textContent = m.photo ? 'Replace' : 'Add close-up photo';
            alert('That photo could not be read. Please take it again.');
            return;
          }
          result.takenAt = stamp();
          m.photo = result;
          renderMarks();
        });
      });

      shot.appendChild(shotImg);
      shot.appendChild(shotInput);
      shot.appendChild(shotLabel);
      body.appendChild(shot);

      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'mark-remove';
      rm.textContent = 'Remove';
      rm.setAttribute('aria-label', 'Remove mark ' + (i + 1) + ', ' + m.type);
      rm.addEventListener('click', function () {
        state.marks = state.marks.filter(function (x) { return x.id !== m.id; });
        renderMarks();
      });

      li.appendChild(num);
      li.appendChild(body);
      li.appendChild(rm);
      list.appendChild(li);
    });

    $('#markEmpty').classList.toggle('is-hidden', state.marks.length > 0);
  }

  /* ---------------------------------------------------------------
     Geolocation — asked once, never blocking
  --------------------------------------------------------------- */

  function setGeoStatus(text, ok) {
    var el = $('#geoStatus');
    el.textContent = text;
    el.classList.toggle('is-on', !!ok);
  }

  $('#geoBtn').addEventListener('click', function () {
    var btn = $('#geoBtn');
    if (state.geoAsked) { return; }
    if (!navigator.geolocation) {
      state.geoAsked = true;
      setGeoStatus('Location not recorded', false);
      btn.disabled = true;
      return;
    }
    state.geoAsked = true;
    btn.disabled = true;
    setGeoStatus('Asking…', false);
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        state.geo = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          at: stamp()
        };
        setGeoStatus(
          state.geo.lat.toFixed(5) + ', ' + state.geo.lon.toFixed(5) +
          ' (±' + Math.round(state.geo.accuracy) + ' m)', true
        );
        btn.textContent = 'Location saved';
      },
      function () {
        state.geo = null;
        setGeoStatus('Location not recorded', false);
        btn.textContent = 'Not available';
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });

  /* ---------------------------------------------------------------
     Step 4 — summary
  --------------------------------------------------------------- */

  function addRow(dl, key, value, warn) {
    var d = document.createElement('div');
    var dt = document.createElement('dt');
    dt.textContent = key;
    var dd = document.createElement('dd');
    dd.textContent = value;
    if (warn) { dd.className = 'warn'; }
    d.appendChild(dt);
    d.appendChild(dd);
    dl.appendChild(d);
  }

  function renderSummary() {
    var t = trip();
    var dl = $('#summary');
    dl.innerHTML = '';
    addRow(dl, 'Inspection', t.phase);
    addRow(dl, 'Rental company', t.company || 'Not given', !t.company);
    addRow(dl, 'Licence plate', t.plate || 'Not given', !t.plate);
    addRow(dl, 'Make and model', t.model || 'Not given', !t.model);
    addRow(dl, 'Odometer', t.odometer || 'Not given', !t.odometer);
    addRow(dl, 'Fuel level', t.fuel);
    addRow(dl, 'Photos taken', photoCount() + ' of ' + SHOTS.length, photoCount() < SHOTS.length);
    addRow(dl, 'Damage marks', String(state.marks.length));
    if (state.marks.length) {
      addRow(dl, 'Close-up photos', markPhotoCount() + ' of ' + state.marks.length,
        markPhotoCount() < state.marks.length);
    }
    addRow(dl, 'Location',
      state.geo
        ? state.geo.lat.toFixed(5) + ', ' + state.geo.lon.toFixed(5)
        : 'Not recorded',
      !state.geo);

    renderPhotoWarning();
  }

  // The 8 walk-around photos are the strongest evidence. Say so loudly if
  // they are missing, but never block the download.
  function renderPhotoWarning() {
    var box = $('#photoWarn');
    var have = photoCount();
    var missing = SHOTS.length - have;

    if (missing === 0) {
      box.classList.add('is-hidden');
      return;
    }

    if (have === 0) {
      $('#photoWarnTitle').textContent = 'You have not taken any photos of the car.';
      $('#photoWarnText').textContent =
        'Your report will show the damage you marked, but not the car itself. ' +
        'Photos of the whole car are the strongest evidence you can have. It takes about a minute.';
      $('#photoWarnBtn').textContent = 'Take the 8 car photos';
    } else {
      $('#photoWarnTitle').textContent = missing === 1
        ? '1 of the 8 car photos is missing.'
        : missing + ' of the 8 car photos are missing.';
      $('#photoWarnText').textContent =
        'You have ' + have + '. The missing ones will not be in the report. ' +
        'Go back and take them if you can.';
      $('#photoWarnBtn').textContent = 'Take the missing photos';
    }
    box.classList.remove('is-hidden');
  }

  /* ---------------------------------------------------------------
     PDF export
  --------------------------------------------------------------- */

  // Screen colour -> print colour, used only for the copy of the diagram in the PDF.
  var PRINT_FILL = {
    '#1E2530': '#F3F5F8',   // body
    '#2A323E': '#DCE2EA',   // glass
    '#232B36': '#E9EDF2',   // roof
    '#11161D': '#4E5766',   // wheels
    '#3A4452': '#C6CDD7',   // front lights
    '#4A2A2A': '#E9C9C5',   // rear lights
    '#7C8899': '#5B6474'    // FRONT / REAR labels
  };
  var PRINT_STROKE = { '#5C6878': '#7A8494' };

  // Renders the SVG diagram plus its pins into a PNG data URL for the PDF.
  function diagramToPng(cb) {
    try {
      var clone = svg.cloneNode(true);
      clone.setAttribute('xmlns', SVGNS);
      clone.setAttribute('width', '640');
      clone.setAttribute('height', '1240');
      clone.removeAttribute('tabindex');

      // The screen car is dark. On paper a light car with dark edges prints and
      // photocopies far better, so swap the colours on the copy going to the PDF.
      var shapes = clone.querySelectorAll('#carArt *');
      for (var s = 0; s < shapes.length; s++) {
        var f = shapes[s].getAttribute('fill');
        var st = shapes[s].getAttribute('stroke');
        if (f && PRINT_FILL[f]) { shapes[s].setAttribute('fill', PRINT_FILL[f]); }
        if (st && PRINT_STROKE[st]) { shapes[s].setAttribute('stroke', PRINT_STROKE[st]); }
      }

      // The stylesheet does not travel with the clone, so inline the pin colours.
      var pins = clone.querySelectorAll('.pin');
      for (var i = 0; i < pins.length; i++) {
        var circle = pins[i].querySelector('circle');
        var label = pins[i].querySelector('text');
        if (circle) {
          circle.setAttribute('fill', '#FF5B49');
          circle.setAttribute('stroke', '#FFFFFF');
          circle.setAttribute('stroke-width', '2');
        }
        if (label) {
          label.setAttribute('fill', '#FFFFFF');
          label.setAttribute('font-family', 'monospace');
          label.setAttribute('font-size', '15');
          label.setAttribute('font-weight', 'bold');
          label.setAttribute('text-anchor', 'middle');
          label.setAttribute('dominant-baseline', 'central');
        }
      }

      var bg = document.createElementNS(SVGNS, 'rect');
      bg.setAttribute('x', '0');
      bg.setAttribute('y', '0');
      bg.setAttribute('width', '320');
      bg.setAttribute('height', '620');
      bg.setAttribute('fill', '#FFFFFF');
      clone.insertBefore(bg, clone.firstChild);

      var xml = new XMLSerializer().serializeToString(clone);
      var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);

      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        canvas.width = 640;
        canvas.height = 1240;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        try {
          cb(canvas.toDataURL('image/png'));
        } catch (e) {
          cb(null);
        }
      };
      img.onerror = function () { cb(null); };
      img.src = url;
    } catch (e) {
      cb(null);
    }
  }

  function buildPdf(done) {
    var jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPDFCtor) {
      done(new Error('The PDF tool did not load. Check your connection and reload the page.'));
      return;
    }

    var t = trip();
    var now = stamp();
    var doc = new jsPDFCtor({ unit: 'mm', format: 'a4', compress: true });
    var W = 210, H = 297, M = 15;
    var y = M;

    function line(text, size, style, colour) {
      doc.setFont('helvetica', style || 'normal');
      doc.setFontSize(size || 11);
      doc.setTextColor(colour || 40);
      var chunks = doc.splitTextToSize(text, W - M * 2);
      for (var i = 0; i < chunks.length; i++) {
        if (y > H - M) { doc.addPage(); y = M; }
        doc.text(chunks[i], M, y);
        y += size ? size * 0.52 : 6;
      }
    }

    function pair(key, value) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(10);
      doc.setTextColor(90);
      if (y > H - M) { doc.addPage(); y = M; }
      doc.text(key, M, y);
      doc.setFont('courier', 'normal');
      doc.setTextColor(20);
      var chunks = doc.splitTextToSize(String(value), W - M * 2 - 55);
      for (var i = 0; i < chunks.length; i++) {
        doc.text(chunks[i], M + 55, y);
        y += 5.4;
        if (y > H - M && i < chunks.length - 1) { doc.addPage(); y = M; }
      }
      if (!chunks.length) { y += 5.4; }
    }

    /* ---- Page 1: summary ---- */
    doc.setFillColor(14, 17, 22);
    doc.rect(0, 0, W, 26, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(255, 197, 49);
    doc.text('DingProof', M, 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(230);
    doc.text('Vehicle condition report — ' + t.phase, M, 20);
    doc.setFont('courier', 'normal');
    doc.text(t.plate || 'NO PLATE', W - M, 20, { align: 'right' });

    y = 38;
    line('Vehicle and rental', 13, 'bold');
    y += 2;
    pair('Inspection', t.phase);
    pair('Rental company', t.company || 'Not given');
    pair('Licence plate', t.plate || 'Not given');
    pair('Make and model', t.model || 'Not given');
    pair('Odometer', t.odometer || 'Not given');
    pair('Fuel level', t.fuel);

    y += 4;
    line('Report details', 13, 'bold');
    y += 2;
    pair('Created (local)', now.local);
    pair('Created (UTC)', now.iso);
    pair('Photos included', photoCount() + ' of ' + SHOTS.length);
    pair('Damage marks', String(state.marks.length));
    pair('Close-up photos', String(markPhotoCount()));
    if (state.geo) {
      pair('Latitude', state.geo.lat.toFixed(6));
      pair('Longitude', state.geo.lon.toFixed(6));
      pair('Accuracy', Math.round(state.geo.accuracy) + ' m');
      pair('Location taken', state.geo.at.iso);
    } else {
      pair('Location', 'Location not recorded');
    }

    y += 4;
    line('Damage marked by the driver', 13, 'bold');
    y += 2;
    if (!state.marks.length) {
      line('No damage was marked during this inspection.', 10, 'normal', 90);
    } else {
      state.marks.forEach(function (m, i) {
        line((i + 1) + '. ' + m.type + (m.note ? ' \u2014 ' + m.note : ''), 11, 'bold');
        line('    ' + stampText(m.at), 9, 'normal', 110);
        if (m.photo) { line('    Close-up photo included in this report.', 9, 'normal', 110); }
        y += 1;
      });
    }

    y += 5;
    doc.setDrawColor(200);
    if (y > H - M - 22) { doc.addPage(); y = M; }
    doc.line(M, y, W - M, y);
    y += 6;
    line('This report was created by the driver using DingProof, a free browser tool. It is the driver\'s own ' +
         'documentation of the vehicle at the time shown above. It is not an official document and it is not ' +
         'automatically binding on any rental company. All times are given in local time and in ISO 8601 UTC.',
         9, 'normal', 110);

    /* ---- Page 2: diagram ---- */
    diagramToPng(function (png) {
      doc.addPage('a4', 'portrait');
      y = M;
      line('Damage diagram', 15, 'bold');
      y += 2;
      line('Top view. Red pins are the spots the driver marked. ' +
           (state.marks.length ? 'Numbers match the list on page 1.' : 'No marks were added.'),
           10, 'normal', 100);
      y += 4;

      if (png) {
        var maxW = 104, maxH = H - y - M - 4;
        var ratio = 1240 / 640;
        var w = maxW, h = w * ratio;
        if (h > maxH) { h = maxH; w = h / ratio; }
        try {
          doc.addImage(png, 'PNG', (W - w) / 2, y, w, h);
        } catch (e) {
          line('The diagram could not be drawn on this device. The list on page 1 still shows every mark.',
               10, 'normal', 110);
        }
      } else {
        line('The diagram could not be drawn on this device. The list on page 1 still shows every mark.',
             10, 'normal', 110);
      }

      // One photo page: the picture on the left, its title and details in a
      // panel beside it, so a reader can identify the shot without hunting.
      function photoPage(title, rows, p) {
        // Landscape so the picture stays large even with a panel beside it.
        doc.addPage('a4', 'landscape');

        var PW = 297, PH = 210;
        var HEAD = 18;
        var top = HEAD + 7;
        var DETAIL_W = 66;
        var GAP = 7;
        var imgW = PW - M * 2 - DETAIL_W - GAP;
        var imgH = PH - top - M;
        var detailX = M + imgW + GAP;

        // header band: which report this page belongs to
        doc.setFillColor(14, 17, 22);
        doc.rect(0, 0, PW, HEAD, 'F');
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(13);
        doc.setTextColor(255, 197, 49);
        doc.text('DingProof', M, 12);
        doc.setFont('courier', 'normal');
        doc.setFontSize(9);
        doc.setTextColor(235);
        doc.text((t.plate || 'NO PLATE') + '  \u00b7  ' + t.phase, PW - M, 12, { align: 'right' });

        // the photo, scaled to fit its column
        var ratio = p.height / p.width;
        var w = imgW, h = w * ratio;
        if (h > imgH) { h = imgH; w = h / ratio; }
        var ix = M + (imgW - w) / 2;
        var iy = top + (imgH - h) / 2;
        try {
          doc.addImage(p.dataUrl, 'JPEG', ix, iy, w, h);
        } catch (e) {
          doc.setTextColor(120);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(10);
          doc.text('This photo could not be added to the PDF.', M, top + 10);
        }

        // measure the detail panel before drawing, so it can sit on a tint
        var inner = DETAIL_W - 8;
        var titleLines = doc.splitTextToSize(title, inner);
        var blocks = [];
        var panelH = 6 + titleLines.length * 5.6 + 4;
        for (var r = 0; r < rows.length; r++) {
          var valLines = doc.splitTextToSize(String(rows[r][1]), inner);
          blocks.push(valLines);
          panelH += 4.4 + valLines.length * 4.2 + 3;
        }
        panelH += 3;

        doc.setFillColor(243, 245, 248);
        doc.setDrawColor(214, 220, 228);
        doc.roundedRect(detailX, top, DETAIL_W, panelH, 3, 3, 'FD');

        var dy = top + 8;
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(20, 24, 31);
        for (var ti = 0; ti < titleLines.length; ti++) {
          doc.text(titleLines[ti], detailX + 4, dy);
          dy += 5.6;
        }
        dy += 1;
        doc.setDrawColor(206, 213, 222);
        doc.line(detailX + 4, dy, detailX + DETAIL_W - 4, dy);
        dy += 5;

        for (var k = 0; k < rows.length; k++) {
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(7.2);
          doc.setTextColor(118, 128, 142);
          doc.text(String(rows[k][0]).toUpperCase(), detailX + 4, dy);
          dy += 4.4;

          var mono = /plate|utc|local|position/i.test(rows[k][0]);
          doc.setFont(mono ? 'courier' : 'helvetica', 'normal');
          doc.setFontSize(8.6);
          doc.setTextColor(28, 33, 41);
          for (var vi = 0; vi < blocks[k].length; vi++) {
            doc.text(blocks[k][vi], detailX + 4, dy);
            dy += 4.2;
          }
          dy += 3;
        }
      }

      /* ---- One page per damage close-up ---- */
      state.marks.forEach(function (m, i) {
        if (!m.photo) { return; }
        photoPage('Damage ' + (i + 1) + ' \u2014 ' + m.type, [
          ['Mark on diagram', 'Number ' + (i + 1)],
          ['Type of damage', m.type],
          ['Driver\u2019s note', m.note || 'No note added'],
          ['Licence plate', t.plate || 'Not given'],
          ['Inspection', t.phase],
          ['Taken (local)', m.photo.takenAt.local],
          ['Taken (UTC)', m.photo.takenAt.iso]
        ], m.photo);
      });

      /* ---- One page per walk-around photo ---- */
      SHOTS.forEach(function (shot, i) {
        var p = state.photos[shot.key];
        if (!p) { return; }
        photoPage((i + 1) + '. ' + shot.name, [
          ['Position', (i + 1) + ' of ' + SHOTS.length],
          ['What this photo shows', shot.how],
          ['Licence plate', t.plate || 'Not given'],
          ['Inspection', t.phase],
          ['Taken (local)', p.takenAt.local],
          ['Taken (UTC)', p.takenAt.iso]
        ], p);
      });

      var name = 'DingProof_' + safePlate(t.plate) + '_' + fileDateStr(now.date) + '.pdf';
      done(null, doc, name);
    });
  }

  $('#downloadBtn').addEventListener('click', function () {
    var btn = $('#downloadBtn');
    var status = $('#pdfStatus');
    status.className = 'pdf-status mono';
    status.textContent = 'Building your PDF…';
    btn.disabled = true;

    setTimeout(function () {
      buildPdf(function (err, doc, name) {
        btn.disabled = false;
        if (err) {
          status.className = 'pdf-status mono is-error';
          status.textContent = err.message;
          return;
        }
        try {
          doc.save(name);
          status.className = 'pdf-status mono is-ok';
          status.textContent = 'Saved as ' + name;
        } catch (e) {
          status.className = 'pdf-status mono is-error';
          status.textContent = 'The PDF could not be saved on this device.';
        }
      });
    }, 30);
  });

  /* ---------------------------------------------------------------
     Reset and unload warning
  --------------------------------------------------------------- */

  $('#resetBtn').addEventListener('click', function () {
    if (hasData() && !window.confirm('This deletes your photos and marks. Continue?')) { return; }
    state.photos = {};
    state.marks = [];
    state.geo = null;
    state.geoAsked = false;
    $('#tripForm').reset();
    $('#geoBtn').disabled = false;
    $('#geoBtn').textContent = 'Use my location';
    setGeoStatus('Location not recorded', false);
    buildShotList();
    updateShotCount();
    renderMarks();
    $('#pdfStatus').textContent = '';
    $('#pdfStatus').className = 'pdf-status mono';
    goto(1);
  });

  window.addEventListener('beforeunload', function (ev) {
    if (!hasData()) { return; }
    ev.preventDefault();
    ev.returnValue = '';
    return '';
  });

  /* ---------------------------------------------------------------
     Start
  --------------------------------------------------------------- */

  buildShotList();
  buildTypeGrid();
  updateShotCount();
  renderMarks();
  goto(1);
})();
