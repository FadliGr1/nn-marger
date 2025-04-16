/**
 * Main.js - Mengontrol logika aplikasi dan interaksi pengguna
 * untuk KMZ Photo Integrator
 */

// Deklarasi variabel global
let kmzFile = null;
let zipFile = null;
let kmzParser = null;
let photoIntegrator = null;
let kmzData = null;
let photosData = null;
let integrationResult = null;

// Element selectors
const elements = {
  // File upload elements
  kmzUpload: document.getElementById("kmz-upload"),
  kmzFileInput: document.getElementById("kmz-file"),
  kmzBrowseBtn: document.getElementById("kmz-browse-btn"),
  kmzFileInfo: document.getElementById("kmz-file-info"),
  kmzFilename: document.getElementById("kmz-filename"),
  kmzFilesize: document.getElementById("kmz-filesize"),
  kmzRemoveBtn: document.getElementById("kmz-remove-btn"),

  zipUpload: document.getElementById("zip-upload"),
  zipFileInput: document.getElementById("zip-file"),
  zipBrowseBtn: document.getElementById("zip-browse-btn"),
  zipFileInfo: document.getElementById("zip-file-info"),
  zipFilename: document.getElementById("zip-filename"),
  zipFilesize: document.getElementById("zip-filesize"),
  zipRemoveBtn: document.getElementById("zip-remove-btn"),

  // Option elements
  optionMatchName: document.getElementById("option1"),
  optionSequential: document.getElementById("option2"),

  // Process elements
  processBtn: document.getElementById("process-btn"),
  warningContainer: document.getElementById("warning-container"),

  // Result elements
  resultArea: document.getElementById("result-area"),
  totalPlacemarks: document.getElementById("total-placemarks"),
  totalPhotos: document.getElementById("total-photos"),
  integratedPhotos: document.getElementById("integrated-photos"),
  resultLogs: document.getElementById("result-logs"),
  downloadBtn: document.getElementById("download-btn"),

  // Modal elements
  notificationModal: document.getElementById("notification-modal"),
  modalTitle: document.getElementById("modal-title"),
  modalMessage: document.getElementById("modal-message"),
  modalOkBtn: document.getElementById("modal-ok-btn"),
  closeModal: document.querySelector(".close-modal"),

  // Loading overlay
  loadingOverlay: document.getElementById("loading-overlay"),
};

// Inisialisasi aplikasi
document.addEventListener("DOMContentLoaded", init);

/**
 * Inisialisasi aplikasi
 */
function init() {
  // Inisialisasi kelas parser dan integrator
  kmzParser = new KMZParser();
  photoIntegrator = new PhotoIntegrator();

  // Pasang event listeners
  setupEventListeners();
}

/**
 * Mengatur event listeners untuk semua interaksi pengguna
 */
function setupEventListeners() {
  // File Upload KMZ
  elements.kmzBrowseBtn.addEventListener("click", () => elements.kmzFileInput.click());
  elements.kmzFileInput.addEventListener("change", handleKmzFileSelect);
  elements.kmzRemoveBtn.addEventListener("click", removeKmzFile);
  elements.kmzUpload.addEventListener("dragover", handleDragOver);
  elements.kmzUpload.addEventListener("dragleave", handleDragLeave);
  elements.kmzUpload.addEventListener("drop", handleKmzFileDrop);

  // File Upload ZIP
  elements.zipBrowseBtn.addEventListener("click", () => elements.zipFileInput.click());
  elements.zipFileInput.addEventListener("change", handleZipFileSelect);
  elements.zipRemoveBtn.addEventListener("click", removeZipFile);
  elements.zipUpload.addEventListener("dragover", handleDragOver);
  elements.zipUpload.addEventListener("dragleave", handleDragLeave);
  elements.zipUpload.addEventListener("drop", handleZipFileDrop);

  // Process Button
  elements.processBtn.addEventListener("click", processIntegration);

  // Download Button
  elements.downloadBtn.addEventListener("click", downloadResult);

  // Modal
  elements.modalOkBtn.addEventListener("click", closeModal);
  elements.closeModal.addEventListener("click", closeModal);
}

/**
 * Menangani saat file KMZ dipilih melalui dialog
 * @param {Event} event - Event file input change
 */
function handleKmzFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    processKmzFile(file);
  }
}

/**
 * Menangani saat file ZIP dipilih melalui dialog
 * @param {Event} event - Event file input change
 */
function handleZipFileSelect(event) {
  const file = event.target.files[0];
  if (file) {
    processZipFile(file);
  }
}

/**
 * Menangani drag over pada area drop
 * @param {Event} event - Event drag over
 */
function handleDragOver(event) {
  event.preventDefault();
  event.stopPropagation();
  this.classList.add("drag-over");
}

/**
 * Menangani drag leave pada area drop
 * @param {Event} event - Event drag leave
 */
function handleDragLeave(event) {
  event.preventDefault();
  event.stopPropagation();
  this.classList.remove("drag-over");
}

/**
 * Menangani drop file KMZ
 * @param {Event} event - Event drop
 */
function handleKmzFileDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  this.classList.remove("drag-over");

  const file = event.dataTransfer.files[0];
  if (file && file.name.toLowerCase().endsWith(".kmz")) {
    processKmzFile(file);
  } else {
    showNotification("Error", "Silakan unggah file KMZ yang valid.");
  }
}

/**
 * Menangani drop file ZIP
 * @param {Event} event - Event drop
 */
function handleZipFileDrop(event) {
  event.preventDefault();
  event.stopPropagation();
  this.classList.remove("drag-over");

  const file = event.dataTransfer.files[0];
  if (file && file.name.toLowerCase().endsWith(".zip")) {
    processZipFile(file);
  } else {
    showNotification("Error", "Silakan unggah file ZIP yang valid.");
  }
}

/**
 * Memproses file KMZ yang diunggah
 * @param {File} file - File KMZ yang dipilih
 */
async function processKmzFile(file) {
  if (!file.name.toLowerCase().endsWith(".kmz")) {
    showNotification("Error", "Silakan unggah file dengan ekstensi .kmz");
    return;
  }

  try {
    // Tampilkan informasi file
    kmzFile = file;
    elements.kmzFilename.textContent = file.name;
    elements.kmzFilesize.textContent = formatFileSize(file.size);
    elements.kmzFileInfo.style.display = "flex";
    elements.kmzUpload.querySelector(".file-upload-content").style.display = "none";

    // Update status tombol proses
    updateProcessButton();
  } catch (error) {
    console.error("Error saat memproses file KMZ:", error);
    showNotification("Error", "Gagal memproses file KMZ: " + error.message);
  }
}

/**
 * Memproses file ZIP yang diunggah
 * @param {File} file - File ZIP yang dipilih
 */
async function processZipFile(file) {
  if (!file.name.toLowerCase().endsWith(".zip")) {
    showNotification("Error", "Silakan unggah file dengan ekstensi .zip");
    return;
  }

  try {
    // Tampilkan informasi file
    zipFile = file;
    elements.zipFilename.textContent = file.name;
    elements.zipFilesize.textContent = formatFileSize(file.size);
    elements.zipFileInfo.style.display = "flex";
    elements.zipUpload.querySelector(".file-upload-content").style.display = "none";

    // Update status tombol proses
    updateProcessButton();
  } catch (error) {
    console.error("Error saat memproses file ZIP:", error);
    showNotification("Error", "Gagal memproses file ZIP: " + error.message);
  }
}

/**
 * Menghapus file KMZ
 */
function removeKmzFile() {
  kmzFile = null;
  elements.kmzFileInput.value = "";
  elements.kmzFileInfo.style.display = "none";
  elements.kmzUpload.querySelector(".file-upload-content").style.display = "block";
  updateProcessButton();
}

/**
 * Menghapus file ZIP
 */
function removeZipFile() {
  zipFile = null;
  elements.zipFileInput.value = "";
  elements.zipFileInfo.style.display = "none";
  elements.zipUpload.querySelector(".file-upload-content").style.display = "block";
  updateProcessButton();
}

/**
 * Memperbarui status tombol proses berdasarkan ketersediaan file
 */
function updateProcessButton() {
  if (kmzFile && zipFile) {
    elements.processBtn.disabled = false;
  } else {
    elements.processBtn.disabled = true;
  }
}

/**
 * Memproses integrasi foto ke KMZ
 */
async function processIntegration() {
  try {
    // Tampilkan loading overlay
    showLoading(true);

    // Bersihkan warning dan tampilan hasil sebelumnya
    elements.warningContainer.innerHTML = "";
    elements.resultLogs.innerHTML = "";

    // Memproses KMZ untuk ekstrak info placemark
    kmzData = await kmzParser.parseKMZ(kmzFile);

    // Filter placemark yang hanya dimulai dengan "?-"
    kmzData.placemarks = kmzData.placemarks.filter((placemark) => placemark.name && placemark.name.startsWith("?-"));

    // Periksa apakah ada placemark yang dapat diproses
    if (kmzData.placemarks.length === 0) {
      showNotification("Peringatan", 'Tidak ada placemark dengan awalan "?-" yang ditemukan dalam file KMZ.');
      showLoading(false);
      return;
    }

    // Log jumlah placemark yang ditemukan
    console.log(`Ditemukan ${kmzData.placemarks.length} placemark dengan awalan "?-"`);

    // Memproses ZIP foto
    photosData = await photoIntegrator.extractPhotos(zipFile);

    // Tampilkan warning dari ekstraksi foto
    displayWarnings(photosData.warnings);

    // Dapatkan metode integrasi
    const integrationMethod = elements.optionMatchName.checked ? "match-name" : "sequential";

    // Jalankan integrasi dengan membuat KMZ baru
    integrationResult = await photoIntegrator.integratePhotos(kmzParser, kmzData, integrationMethod);

    // Tampilkan warning tambahan dari integrasi
    displayWarnings(integrationResult.warnings);

    // Tampilkan logs
    displayLogs(integrationResult.logs);

    // Tampilkan hasil
    elements.totalPlacemarks.textContent = kmzData.placemarks.length; // Jumlah placemark dengan "?-"
    elements.totalPhotos.textContent = integrationResult.totalPhotos;
    elements.integratedPhotos.textContent = integrationResult.integratedCount;
    elements.resultArea.style.display = "block";

    // Scroll ke area hasil
    elements.resultArea.scrollIntoView({behavior: "smooth"});
  } catch (error) {
    console.error("Error saat mengintegrasikan:", error);
    showNotification("Error", "Gagal mengintegrasikan foto: " + error.message);
  } finally {
    // Sembunyikan loading overlay
    showLoading(false);
  }
}

/**
 * Menampilkan warning dari proses
 * @param {Array} warnings - Array pesan warning
 */
function displayWarnings(warnings) {
  if (!warnings || warnings.length === 0) return;

  for (const warning of warnings) {
    const warningElement = document.createElement("div");
    warningElement.className = "warning";
    warningElement.innerHTML = `
            <i class="fas fa-exclamation-triangle"></i>
            <p>${warning}</p>
        `;
    elements.warningContainer.appendChild(warningElement);
  }
}

/**
 * Menampilkan log dari proses integrasi
 * @param {Array} logs - Array log proses
 */
function displayLogs(logs) {
  if (!logs || logs.length === 0) return;

  for (const log of logs) {
    const logElement = document.createElement("div");
    logElement.className = `log-item log-${log.status}`;
    logElement.textContent = log.message;
    elements.resultLogs.appendChild(logElement);
  }
}

/**
 * Download hasil integrasi
 */
async function downloadResult() {
  try {
    showLoading(true);

    // Periksa apakah ada hasil integrasi
    if (!integrationResult || !integrationResult.kmzBlob) {
      throw new Error("Tidak ada hasil integrasi untuk diunduh");
    }

    // Buat URL untuk download
    const downloadUrl = URL.createObjectURL(integrationResult.kmzBlob);

    // Buat element a untuk download
    const downloadLink = document.createElement("a");
    downloadLink.href = downloadUrl;

    // Buat nama file baru
    const originalName = kmzFile.name;
    const nameParts = originalName.split(".");
    const extension = nameParts.pop();
    const baseName = nameParts.join(".");
    const newFileName = `${baseName}_with_photos.${extension}`;

    downloadLink.download = newFileName;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);

    // Pembersihan
    URL.revokeObjectURL(downloadUrl);

    // Tampilkan notifikasi sukses
    showNotification("Sukses", "File KMZ dengan foto terintegrasi berhasil diunduh.");
  } catch (error) {
    console.error("Error saat mengunduh hasil:", error);
    showNotification("Error", "Gagal mengunduh hasil: " + error.message);
  } finally {
    showLoading(false);
  }
}

/**
 * Format ukuran file ke bentuk yang mudah dibaca
 * @param {Number} bytes - Ukuran file dalam bytes
 * @returns {String} - Ukuran file yang diformat
 */
function formatFileSize(bytes) {
  if (bytes === 0) return "0 Bytes";

  const k = 1024;
  const sizes = ["Bytes", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));

  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

/**
 * Menampilkan modal notifikasi
 * @param {String} title - Judul notifikasi
 * @param {String} message - Pesan notifikasi
 */
function showNotification(title, message) {
  elements.modalTitle.textContent = title;
  elements.modalMessage.textContent = message;
  elements.notificationModal.classList.add("show");
}

/**
 * Menutup modal notifikasi
 */
function closeModal() {
  elements.notificationModal.classList.remove("show");
}

/**
 * Menampilkan atau menyembunyikan loading overlay
 * @param {Boolean} show - Flag untuk menampilkan atau menyembunyikan
 */
function showLoading(show) {
  if (show) {
    elements.loadingOverlay.classList.add("show");
  } else {
    elements.loadingOverlay.classList.remove("show");
  }
}
