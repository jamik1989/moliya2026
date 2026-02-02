// web/assets/js/utils/pdfExport.js
(() => {
  "use strict";

  /**
   * Elementni PDF qilib saqlash
   * @param {Object} options - { elementId, filename, title }
   */
  async function exportElementToPdf({ elementId, filename = "hisobot.pdf" }) {
    const element = document.getElementById(elementId);
    
    if (!element) {
      console.error("PDF export: Element topilmadi - " + elementId);
      return;
    }

    // html2pdf yuklanganini tekshirish
    if (typeof html2pdf === "undefined") {
      alert("Xato: PDF kutubxonasi yuklanmagan. Internet aloqasini tekshiring.");
      return;
    }

    // PDF sozlamalari
    const opt = {
      margin:       [0.5, 0.5], // yuqori va yon chekkalar
      filename:     filename,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { 
        scale: 2, 
        useCORS: true, 
        letterRendering: true,
        logging: false 
      },
      jsPDF:        { unit: 'in', format: 'letter', orientation: 'landscape' } // Jadvallar keng bo'lgani uchun 'landscape' (albom)
    };

    try {
      // PDF yaratish jarayoni
      await html2pdf().set(opt).from(element).save();
    } catch (error) {
      console.error("PDF yaratishda xatolik:", error);
      alert("PDF yaratib bo'lmadi. Konsolni tekshiring.");
    }
  }

  // Global obyektga bog'lash
  window.AppPDF = { export: exportElementToPdf };
})();