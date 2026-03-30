window.PdfService = (() => {
  function createPdf({ state, analysis, getValue }) {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF({ unit: "mm", format: "a4" });

    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 14;
    const contentWidth = pageWidth - margin * 2;
    const company = window.StorageService.loadSettings();

    let y = 22;
    let pageNo = 1;

    const palette = {
      navy: [17, 37, 68],
      text: [33, 37, 41],
      muted: [108, 117, 125],
      line: [222, 226, 230],
      soft: [245, 247, 250],
      blueSoft: [239, 246, 255],
      greenSoft: [236, 253, 245],
      redSoft: [254, 242, 242],
      yellowSoft: [255, 251, 235],
      graySoft: [243, 244, 246],
      green: [22, 130, 55],
      red: [185, 28, 28],
      amber: [180, 120, 20],
      gray: [107, 114, 128],
    };

    function safeText(value) {
      const text = value == null || value === "" || value === "null" ? "-" : String(value);
      return text
        .replace(/č/g, "c")
        .replace(/ć/g, "c")
        .replace(/ž/g, "z")
        .replace(/š/g, "s")
        .replace(/đ/g, "dj")
        .replace(/Č/g, "C")
        .replace(/Ć/g, "C")
        .replace(/Ž/g, "Z")
        .replace(/Š/g, "S")
        .replace(/Đ/g, "Dj");
    }

    function footer() {
      doc.setDrawColor(...palette.line);
      doc.line(margin, pageHeight - 12, pageWidth - margin, pageHeight - 12);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(...palette.muted);

      const left = safeText(
        [company.companyName, company.companyEmail, company.companyPhone]
          .filter(Boolean)
          .join(" • ") || "A-test analizator"
      );

      doc.text(left, margin, pageHeight - 7);
      doc.text(`Stranica ${pageNo}`, pageWidth - margin, pageHeight - 7, { align: "right" });
    }

    function drawHeader(firstPage = false) {
      doc.setFillColor(...palette.navy);
      doc.rect(0, 0, pageWidth, 18, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(13);
      doc.setTextColor(255, 255, 255);
      doc.text("IZVJESTAJ O ISPITIVANJU ELEKTROINSTALACIJE", margin, 11);

      if (firstPage && state.companyLogoDataUrl) {
        try {
          doc.addImage(state.companyLogoDataUrl, "PNG", pageWidth - 30, 3, 12, 12);
        } catch (error) {
          console.error("Logo PDF error", error);
        }
      }
    }

    function newPage() {
      footer();
      doc.addPage();
      pageNo += 1;
      drawHeader(false);
      y = 24;
    }

    function ensurePage(spaceNeeded = 10) {
      if (y + spaceNeeded > pageHeight - 18) {
        newPage();
      }
    }

    function section(title) {
      ensurePage(12);

      doc.setFillColor(...palette.soft);
      doc.roundedRect(margin, y, contentWidth, 8, 2, 2, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(10);
      doc.setTextColor(...palette.text);
      doc.text(safeText(title), margin + 3, y + 5.2);

      y += 11;
    }

    function textLine(label, value) {
      ensurePage(6);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(9.3);
      doc.setTextColor(...palette.text);
      doc.text(safeText(label), margin, y);

      doc.setFont("helvetica", "normal");
      doc.text(safeText(value), margin + 54, y);

      y += 5.5;
    }

    function paragraph(text) {
      const lines = doc.splitTextToSize(safeText(text), contentWidth);
      const lineHeight = 4.6;

      ensurePage(lines.length * lineHeight + 2);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(9.5);
      doc.setTextColor(...palette.text);
      doc.text(lines, margin, y);

      y += lines.length * lineHeight + 1;
    }

    function levelLabel(level) {
      if (level === "ok") return "ISPRAVNO";
      if (level === "warn") return "UPOZORENJE";
      if (level === "danger") return "KRITICNO";
      return "N/A";
    }

    function levelColor(level) {
      if (level === "ok") return palette.green;
      if (level === "warn") return palette.amber;
      if (level === "danger") return palette.red;
      return palette.gray;
    }

    function summaryCards() {
      ensurePage(24);

      const gap = 5;
      const boxW = (contentWidth - gap * 2) / 3;
      const cards = [
        {
          title: "Konacni score",
          value: `${analysis.score}/100`,
          fill: palette.blueSoft,
        },
        {
          title: "Status",
          value: analysis.safe ? "SIGURNO" : "NIJE SIGURNO",
          fill: analysis.safe ? palette.greenSoft : palette.redSoft,
        },
        {
          title: "Kriticno / Upozorenja / N/A",
          value: `${analysis.criticalItems.length} / ${analysis.warningItems.length} / ${analysis.naItems.length}`,
          fill: palette.yellowSoft,
        },
      ];

      cards.forEach((card, index) => {
        const x = margin + index * (boxW + gap);

        doc.setFillColor(...card.fill);
        doc.setDrawColor(...palette.line);
        doc.roundedRect(x, y, boxW, 18, 3, 3, "FD");

        doc.setFont("helvetica", "bold");
        doc.setFontSize(7.6);
        doc.setTextColor(...palette.muted);
        doc.text(card.title, x + 4, y + 5.5);

        doc.setFontSize(12);
        doc.setTextColor(...palette.navy);
        doc.text(safeText(card.value), x + 4, y + 12.5);
      });

      y += 22;
    }

    function drawResultsTable(items) {
      section("Rezultati mjerenja i provjera");

      const x1 = margin;
      const x2 = margin + 70;
      const x3 = margin + 112;
      const x4 = pageWidth - margin;

      const w1 = 64;
      const w2 = 36;
      const w3 = 32;

      ensurePage(12);

      doc.setFillColor(...palette.soft);
      doc.rect(margin, y - 1, contentWidth, 8, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.2);
      doc.setTextColor(...palette.muted);
      doc.text("Stavka", x1, y + 4);
      doc.text("Vrijednost", x2, y + 4);
      doc.text("Granica", x3, y + 4);
      doc.text("Status", x4, y + 4, { align: "right" });

      y += 9;

      items.forEach((item) => {
        const measuredRaw = item.measured == null ? "-" : item.measured;
        const measured = safeText(item.unit ? `${measuredRaw} ${item.unit}` : measuredRaw);
        const limit = safeText(item.limitText || "-");

        const labelLines = doc.splitTextToSize(safeText(item.label), w1);
        const measuredLines = doc.splitTextToSize(measured, w2);
        const limitLines = doc.splitTextToSize(limit, w3);

        const maxLines = Math.max(labelLines.length, measuredLines.length, limitLines.length, 1);
        const rowHeight = Math.max(7, maxLines * 4.4 + 2);

        ensurePage(rowHeight + 2);

        doc.setDrawColor(...palette.line);
        doc.line(margin, y + rowHeight, pageWidth - margin, y + rowHeight);

        doc.setFont("helvetica", "normal");
        doc.setFontSize(8.3);
        doc.setTextColor(...palette.text);

        doc.text(labelLines, x1, y + 4.2);
        doc.text(measuredLines, x2, y + 4.2);
        doc.text(limitLines, x3, y + 4.2);

        doc.setFont("helvetica", "bold");
        doc.setTextColor(...levelColor(item.level));
        doc.text(levelLabel(item.level), x4, y + 4.2, { align: "right" });

        y += rowHeight + 1.5;
      });
    }

    function bulletList(title, rows) {
      section(title);

      if (!rows.length) {
        paragraph("Nema dodatnih stavki za prikaz.");
        return;
      }

      rows.forEach((row, index) => {
        const lines = doc.splitTextToSize(safeText(row), contentWidth - 10);
        const h = lines.length * 4.6 + 2;

        ensurePage(h);

        doc.setFont("helvetica", "bold");
        doc.setFontSize(9);
        doc.setTextColor(...palette.text);
        doc.text(`${index + 1}.`, margin, y);

        doc.setFont("helvetica", "normal");
        doc.text(lines, margin + 8, y);

        y += h;
      });
    }

    function installationTypeLabel(type) {
      const labels = {
        stambena: "Stambena",
        poslovna: "Poslovna",
        industrijska: "Industrijska",
        ostalo: "Ostalo",
        fotonaponska: "Fotonaponska elektrana",
        "ev-punionica": "EV punionica",
      };
      return labels[type] || type || "-";
    }

    drawHeader(true);
    y = 26;

    doc.setFont("helvetica", "bold");
    doc.setFontSize(16);
    doc.setTextColor(...palette.text);
    doc.text(safeText(getValue("projectName") || "Naziv projekta"), margin, y);

    y += 7;
    doc.setFont("helvetica", "normal");
    doc.setFontSize(10);
    doc.setTextColor(...palette.muted);
    doc.text(safeText(company.companyName || "Naziv firme"), margin, y);

    y += 10;

    section("Osnovni podaci");
    textLine("Broj izvjestaja", getValue("reportNumber"));
    textLine("Datum", getValue("date"));
    textLine("Narucitelj", getValue("clientName"));
    textLine("Lokacija", getValue("location"));
    textLine("Ispitivac", getValue("inspectorName"));
    textLine("Objekt", getValue("objectName"));
    textLine("Tip instalacije", installationTypeLabel(getValue("installationType")));
    textLine("Sustav napajanja", getValue("supplySystem"));
    textLine("Nazivni napon", `${getValue("nominalVoltage") || "-"} V`);
    textLine("Frekvencija", `${getValue("frequency") || "-"} Hz`);

    if (state.objectPhotoDataUrl) {
      ensurePage(44);
      try {
        doc.setDrawColor(...palette.line);
        doc.roundedRect(margin, y, 58, 38, 2, 2, "S");
        doc.addImage(state.objectPhotoDataUrl, "PNG", margin + 2, y + 2, 54, 34);
        y += 42;
      } catch (error) {
        console.error("Object photo PDF error", error);
      }
    }

    summaryCards();

    section("Zakljucak");
    paragraph(analysis.verdict);

    drawResultsTable(analysis.items);

    if (state.circuits.length) {
      bulletList(
        "Krugovi i osiguraci",
        state.circuits.map((circuit) =>
          `${safeText(circuit.name)} | ${safeText(circuit.breaker || "-")} | ${safeText(circuit.cable || "-")} | Zs: ${safeText(circuit.zs || "-")} Ω | Pad: ${safeText(circuit.drop || "-")} % | ${safeText(circuit.result || "-")}`
        )
      );
    }

    bulletList(
      "Preporuke",
      [...analysis.criticalItems, ...analysis.warningItems].length
        ? [...analysis.criticalItems, ...analysis.warningItems].map(
            (item) => `${item.label}: ${item.recommendation}`
          )
        : ["Nisu potrebne dodatne korekcije prema unesenim podacima."]
    );

    if (getValue("notes")) {
      section("Napomene");
      paragraph(getValue("notes"));
    }

    section("Potvrda i potpis");
    textLine("Odgovorna osoba", company.responsiblePerson || "-");
    textLine("Firma", company.companyName || "-");

    if (company.signatureText) {
      paragraph(company.signatureText);
    }

    ensurePage(34);

    doc.setDrawColor(...palette.line);
    doc.line(margin, y + 20, margin + 70, y + 20);

    doc.setFont("helvetica", "normal");
    doc.setFontSize(8.5);
    doc.setTextColor(...palette.muted);
    doc.text("Potpis i ovjera", margin, y + 25);

    if (state.signatureDataUrl) {
      try {
        doc.addImage(state.signatureDataUrl, "PNG", margin, y, 70, 18);
      } catch (error) {
        console.error("Signature PDF error", error);
      }
    }

    footer();

    const filename = `${safeText(getValue("projectName") || "atest-izvjestaj")
      .toLowerCase()
      .replace(/\s+/g, "-")}.pdf`;

    doc.save(filename);
  }

  return { createPdf };
})();