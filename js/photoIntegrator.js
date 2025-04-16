/**
 * Photo Integrator - Module untuk mengintegrasikan foto ke dalam file KMZ
 */
class PhotoIntegrator {
  constructor() {
    this.jszip = new JSZip();
    this.photos = [];
    this.warnings = [];
    this.logs = [];
  }

  /**
   * Memproses file ZIP yang berisi foto
   * @param {File} file - File ZIP yang diunggah
   * @returns {Promise} - Promise yang menyelesaikan proses ekstraksi foto
   */
  async extractPhotos(file) {
    try {
      this.photos = [];
      this.warnings = [];

      // Load file ZIP
      const zipContent = await this.jszip.loadAsync(file);

      // Temukan semua file foto dalam arsip
      const photoPromises = [];
      const validExtensions = [".jpg", ".jpeg", ".png", ".gif"];

      for (const filename in zipContent.files) {
        // Lewati folder
        if (zipContent.files[filename].dir) continue;

        // Periksa ekstensi file
        const isValidImage = validExtensions.some((ext) => filename.toLowerCase().endsWith(ext));

        if (isValidImage) {
          // Proses file gambar
          photoPromises.push(this.processImageFile(zipContent.files[filename]));
        }
      }

      // Tunggu semua foto diproses
      await Promise.all(photoPromises);

      // Periksa apakah foto ditemukan
      if (this.photos.length === 0) {
        this.warnings.push("Tidak ada file foto yang ditemukan dalam arsip ZIP");
      }

      return {
        photos: this.photos,
        warnings: this.warnings,
      };
    } catch (error) {
      console.error("Error saat mengekstrak foto:", error);
      throw error;
    }
  }

  /**
   * Memproses file gambar dari ZIP
   * @param {Object} file - Objek file dari JSZip
   * @returns {Promise} - Promise untuk pemrosesan file gambar
   */
  async processImageFile(file) {
    try {
      // Dapatkan nama file dan ekstensi
      const fullPath = file.name;
      const pathParts = fullPath.split("/");
      const filename = pathParts[pathParts.length - 1];

      // Ekstrak hanya nama file tanpa ekstensi
      const filenameParts = filename.split(".");
      const extension = filenameParts.pop().toLowerCase();
      const nameWithoutExt = filenameParts.join(".");

      // Tentukan tipe MIME berdasarkan ekstensi
      let mimeType;
      switch (extension) {
        case "jpg":
        case "jpeg":
          mimeType = "image/jpeg";
          break;
        case "png":
          mimeType = "image/png";
          break;
        case "gif":
          mimeType = "image/gif";
          break;
        default:
          mimeType = "application/octet-stream";
      }

      // Baca konten file sebagai array buffer
      const arrayBuffer = await file.async("arraybuffer");

      // Konversi array buffer ke base64
      const base64Data = this.arrayBufferToBase64(arrayBuffer);

      // Tambahkan foto ke array
      this.photos.push({
        name: nameWithoutExt,
        fullPath,
        mimeType,
        base64Data,
        extension,
      });
    } catch (error) {
      console.error("Error saat memproses file gambar:", error);
      this.warnings.push(`Error saat memproses ${file.name}: ${error.message}`);
    }
  }

  /**
   * Konversi ArrayBuffer ke string Base64
   * @param {ArrayBuffer} buffer - Buffer data
   * @returns {String} - String Base64
   */
  arrayBufferToBase64(buffer) {
    let binary = "";
    const bytes = new Uint8Array(buffer);
    const len = bytes.byteLength;

    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i]);
    }

    return window.btoa(binary);
  }

  /**
   * Mengintegrasikan foto ke file KMZ baru dengan metode yang dipilih
   * @param {Object} kmzParser - Instance KMZParser
   * @param {Object} kmzData - Data dari KMZ parser
   * @param {String} method - Metode integrasi ('match-name' atau 'sequential')
   * @returns {Object} - Hasil integrasi & file KMZ baru
   */
  async integratePhotos(kmzParser, kmzData, method) {
    this.logs = [];

    try {
      // Buat KML baru dengan foto yang terintegrasi
      const {kmlDoc, integratedCount, integratedPhotos} = kmzParser.createNewKML(kmzData.placemarks, this.photos, method);

      // Buat file KMZ baru dengan KML dan file foto terpisah
      const newKmzBlob = await kmzParser.createNewKMZ(kmlDoc, integratedPhotos);

      // Log hasil
      this.logIntegrationResults(method, kmzData.placemarks.length, this.photos.length, integratedCount);

      // Periksa jika jumlah foto dan placemark tidak sama
      this.checkMismatchWarnings(kmzData.placemarks.length, this.photos.length, method);

      return {
        totalPlacemarks: kmzData.placemarks.length,
        totalPhotos: this.photos.length,
        integratedCount: integratedCount,
        warnings: this.warnings,
        logs: this.logs,
        kmlDoc: kmlDoc,
        kmzBlob: newKmzBlob,
      };
    } catch (error) {
      console.error("Error saat mengintegrasikan foto:", error);
      this.warnings.push("Error saat mengintegrasikan foto: " + error.message);
      throw error;
    }
  }

  /**
   * Catat hasil integrasi ke log
   * @param {String} method - Metode integrasi
   * @param {Number} placemarkCount - Jumlah total placemark
   * @param {Number} photoCount - Jumlah total foto
   * @param {Number} integratedCount - Jumlah foto yang berhasil diintegrasikan
   */
  logIntegrationResults(method, placemarkCount, photoCount, integratedCount) {
    this.logs.push({
      status: "success",
      message: `Berhasil membuat file KMZ baru dengan ${integratedCount} placemark yang memiliki foto`,
    });

    this.logs.push({
      status: "info",
      message: `Total placemark dengan awalan "?-": ${placemarkCount}`,
    });

    this.logs.push({
      status: "info",
      message: `Deskripsi gambar menggunakan format sederhana: <img style="max-width:500px;" src="files/filename.jpg"/>`,
    });

    if (method === "match-name") {
      this.logs.push({
        status: "info",
        message: `Integrasi menggunakan metode pencocokan nama`,
      });
    } else {
      this.logs.push({
        status: "info",
        message: `Integrasi menggunakan metode berurutan`,
      });
    }
  }

  /**
   * Periksa dan catat warning jika jumlah foto & placemark tidak cocok
   * @param {Number} placemarkCount - Jumlah total placemark
   * @param {Number} photoCount - Jumlah total foto
   * @param {String} method - Metode integrasi
   */
  checkMismatchWarnings(placemarkCount, photoCount, method) {
    if (method === "sequential") {
      if (placemarkCount > photoCount) {
        this.warnings.push(`Jumlah foto (${photoCount}) lebih sedikit dari jumlah placemark (${placemarkCount})`);
        this.logs.push({
          status: "warning",
          message: `Beberapa placemark tidak mendapatkan foto karena jumlah foto tidak mencukupi`,
        });
      } else if (placemarkCount < photoCount) {
        this.warnings.push(`Jumlah foto (${photoCount}) lebih banyak dari jumlah placemark (${placemarkCount})`);
        this.logs.push({
          status: "warning",
          message: `Beberapa foto tidak digunakan karena jumlah placemark tidak mencukupi`,
        });
      }
    } else if (method === "match-name") {
      const notMatchedCount = photoCount - this.logs.filter((log) => log.status === "success").length;
      if (notMatchedCount > 0) {
        this.logs.push({
          status: "warning",
          message: `${notMatchedCount} foto tidak cocok dengan nama placemark yang tersedia`,
        });
      }
    }
  }
}
