/*
 * Offline engine bridge, runs inside a hidden WebView.
 * Libraries (pdf.js, mammoth, docx, SheetJS) are inlined into engine.html by
 * scripts/build-engine.js, so nothing is ever loaded from the network.
 */
(function () {
  var docs = {};

  function b64ToBytes(b64) {
    var bin = atob(b64);
    var len = bin.length;
    var bytes = new Uint8Array(len);
    for (var i = 0; i < len; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }

  function bytesToB64(bytes) {
    var chunk = 0x8000;
    var parts = [];
    for (var i = 0; i < bytes.length; i += chunk) {
      parts.push(String.fromCharCode.apply(null, bytes.subarray(i, i + chunk)));
    }
    return btoa(parts.join(''));
  }

  var MAX_PIXELS = 24000000; // keep canvases within WebView memory limits

  var handlers = {
    ping: function () {
      return { ok: true };
    },

    openPdf: async function (a) {
      var task = pdfjsLib.getDocument({
        data: b64ToBytes(a.data),
        password: a.password || undefined,
        isEvalSupported: false,
      });
      var doc = await task.promise;
      docs[a.id] = doc;
      return { numPages: doc.numPages };
    },

    closePdf: async function (a) {
      if (docs[a.id]) {
        await docs[a.id].destroy();
        delete docs[a.id];
      }
      return {};
    },

    renderPage: async function (a) {
      var doc = docs[a.id];
      var page = await doc.getPage(a.page + 1);
      var scale = a.scale || 2;
      var vp = page.getViewport({ scale: scale });
      var px = vp.width * vp.height;
      if (px > MAX_PIXELS) {
        scale = scale * Math.sqrt(MAX_PIXELS / px);
        vp = page.getViewport({ scale: scale });
      }
      var canvas = document.createElement('canvas');
      canvas.width = Math.floor(vp.width);
      canvas.height = Math.floor(vp.height);
      var ctx = canvas.getContext('2d');
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      var mime = a.mime || 'image/jpeg';
      var url = canvas.toDataURL(mime, a.quality != null ? a.quality : 0.9);
      var out = {
        data: url.substring(url.indexOf(',') + 1),
        width: canvas.width,
        height: canvas.height,
        pointWidth: page.getViewport({ scale: 1 }).width,
        pointHeight: page.getViewport({ scale: 1 }).height,
      };
      canvas.width = 0;
      canvas.height = 0;
      page.cleanup();
      return out;
    },

    pageText: async function (a) {
      var doc = docs[a.id];
      var page = await doc.getPage(a.page + 1);
      var vp = page.getViewport({ scale: 1 });
      var tc = await page.getTextContent();
      var items = [];
      for (var i = 0; i < tc.items.length; i++) {
        var it = tc.items[i];
        if (!it.str) continue;
        var t = it.transform;
        items.push({
          str: it.str,
          x: t[4],
          y: vp.height - t[5],
          w: it.width,
          h: it.height || Math.abs(t[3]) || 10,
          eol: !!it.hasEOL,
        });
      }
      page.cleanup();
      return { width: vp.width, height: vp.height, items: items };
    },

    docxToHtml: async function (a) {
      var bytes = b64ToBytes(a.data);
      var res = await mammoth.convertToHtml(
        { arrayBuffer: bytes.buffer },
        { convertImage: mammoth.images.dataUri }
      );
      return { html: res.value, warnings: res.messages.length };
    },

    buildDocx: async function (a) {
      var D = docx;
      var children = [];
      if (a.title) {
        children.push(
          new D.Paragraph({ text: a.title, heading: D.HeadingLevel.HEADING_1 })
        );
      }
      for (var i = 0; i < a.paragraphs.length; i++) {
        var p = a.paragraphs[i];
        children.push(
          new D.Paragraph({
            pageBreakBefore: !!p.pageBreakBefore,
            children: [new D.TextRun({ text: p.text, bold: !!p.bold, size: p.size || 22 })],
          })
        );
      }
      var document_ = new D.Document({ sections: [{ children: children }] });
      var b64 = await D.Packer.toBase64String(document_);
      return { data: b64 };
    },

    buildXlsx: async function (a) {
      var wb = XLSX.utils.book_new();
      for (var i = 0; i < a.sheets.length; i++) {
        var s = a.sheets[i];
        var ws = XLSX.utils.aoa_to_sheet(s.rows.length ? s.rows : [['(no text found)']]);
        XLSX.utils.book_append_sheet(wb, ws, (s.name || 'Sheet' + (i + 1)).substring(0, 31));
      }
      var b64 = XLSX.write(wb, { type: 'base64', bookType: 'xlsx' });
      return { data: b64 };
    },
  };

  function reply(msg) {
    window.ReactNativeWebView.postMessage(JSON.stringify(msg));
  }

  async function onMessage(ev) {
    var msg;
    try {
      msg = JSON.parse(ev.data);
    } catch (e) {
      return;
    }
    if (!msg || !msg.reqId) return;
    try {
      var fn = handlers[msg.method];
      if (!fn) throw new Error('Unknown engine method: ' + msg.method);
      var result = await fn(msg.args || {});
      reply({ reqId: msg.reqId, result: result });
    } catch (e) {
      var name = e && e.name;
      reply({
        reqId: msg.reqId,
        error: (e && e.message) || String(e),
        code: name === 'PasswordException' ? 'PASSWORD' : undefined,
      });
    }
  }

  document.addEventListener('message', onMessage);
  window.addEventListener('message', onMessage);
  window.__engineBytesToB64 = bytesToB64;
  reply({ ready: true });
})();
