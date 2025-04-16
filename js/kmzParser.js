/**
 * KMZ Parser - Module untuk mengekstrak dan memproses file KMZ
 */
class KMZParser {
  constructor() {
    this.jszip = new JSZip();
    this.kmlContent = null;
    this.placemarks = [];
    this.folderStructure = {};
    this.parser = new DOMParser();
  }

  /**
   * Memproses file KMZ yang diunggah
   * @param {File} file - File KMZ yang diunggah
   * @returns {Promise} - Promise yang menyelesaikan proses parsing KMZ
   */
  async parseKMZ(file) {
    try {
      // Load dan ekstrak KMZ (yang pada dasarnya adalah file ZIP)
      const zipContent = await this.jszip.loadAsync(file);

      // Temukan file KML dalam arsip KMZ
      let kmlFile = null;

      // Cari file KML dalam arsip
      for (const filename in zipContent.files) {
        if (filename.toLowerCase().endsWith(".kml")) {
          kmlFile = zipContent.files[filename];
          break;
        }
      }

      if (!kmlFile) {
        throw new Error("Tidak dapat menemukan file KML dalam KMZ");
      }

      // Baca konten KML
      const kmlString = await kmlFile.async("text");
      this.kmlContent = this.parser.parseFromString(kmlString, "application/xml");

      // Proses placemarks dan struktur folder
      this.processKML();

      return {
        placemarks: this.placemarks,
        folderStructure: this.folderStructure,
        zipContent: zipContent,
        kmlContent: this.kmlContent,
      };
    } catch (error) {
      console.error("Error saat memproses KMZ:", error);
      throw error;
    }
  }

  /**
   * Memproses konten KML untuk mengekstrak placemarks dan struktur folder
   * Filter placemark yang hanya dimulai dengan "?-"
   */
  processKML() {
    this.placemarks = [];
    this.folderStructure = {};

    // Temukan semua Placemarks dalam KML
    const placemarkElements = this.kmlContent.getElementsByTagName("Placemark");

    for (let i = 0; i < placemarkElements.length; i++) {
      const placemark = placemarkElements[i];
      const placemarkData = this.extractPlacemarkData(placemark);

      // Filter hanya placemark yang namanya dimulai dengan "?-"
      if (placemarkData && placemarkData.name.startsWith("?-")) {
        this.placemarks.push(placemarkData);

        // Tambahkan ke struktur folder
        const pathParts = placemarkData.path.split("/");
        let currentLevel = this.folderStructure;

        // Buat struktur folder bersarang
        for (let j = 0; j < pathParts.length - 1; j++) {
          const folderName = pathParts[j];
          if (!folderName) continue;

          if (!currentLevel[folderName]) {
            currentLevel[folderName] = {};
          }
          currentLevel = currentLevel[folderName];
        }

        // Tambahkan placemark ke level terakhir
        const placemarkName = pathParts[pathParts.length - 1];
        if (placemarkName) {
          currentLevel[placemarkName] = {
            type: "placemark",
            id: placemarkData.id,
          };
        }
      }
    }

    console.log(`Total placemarks dengan nama "?-": ${this.placemarks.length}`);
  }

  /**
   * Ekstrak data dari elemen Placemark
   * @param {Element} placemark - Elemen Placemark dari KML
   * @returns {Object} - Data placemark yang diekstrak
   */
  extractPlacemarkData(placemark) {
    try {
      const id = placemark.getAttribute("id") || this.generateUniqueId();
      const nameElement = placemark.getElementsByTagName("name")[0];
      const name = nameElement ? nameElement.textContent.trim() : "Tanpa nama";

      // Filter hanya untuk nama yang dimulai dengan "?-"
      if (!name.startsWith("?-")) {
        return null;
      }

      const descriptionElement = placemark.getElementsByTagName("description")[0];
      const description = descriptionElement ? descriptionElement.textContent : "";

      // Ekstrak koordinat
      let coordinates = null;
      let point = placemark.getElementsByTagName("Point")[0];
      if (point) {
        const coordsElement = point.getElementsByTagName("coordinates")[0];
        if (coordsElement) {
          const coordsText = coordsElement.textContent.trim();
          const [longitude, latitude, altitude] = coordsText.split(",").map(Number);
          coordinates = {longitude, latitude, altitude: altitude || 0};
        }
      }

      // Temukan jalur folder yang berisi placemark ini
      const path = this.getPlacemarkPath(placemark);

      return {
        id,
        name,
        description,
        coordinates,
        element: placemark,
        path,
      };
    } catch (error) {
      console.error("Error saat ekstraksi data placemark:", error);
      return null;
    }
  }

  /**
   * Mendapatkan jalur folder untuk placemark
   * @param {Element} element - Element yang akan diperiksa jalurnya
   * @returns {String} - Jalur folder placemark
   */
  getPlacemarkPath(element) {
    const path = [];
    let current = element;

    // Naik ke parent sampai Document
    while (current && current.nodeName !== "Document") {
      if (current.nodeName === "Folder" || current.nodeName === "Placemark") {
        const nameElement = current.getElementsByTagName("name")[0];
        if (nameElement) {
          path.unshift(nameElement.textContent);
        }
      }
      current = current.parentNode;
    }

    return path.join("/");
  }

  /**
   * Menghasilkan ID unik untuk placemark
   * @returns {String} - ID unik
   */
  generateUniqueId() {
    return "placemark_" + Math.random().toString(36).substr(2, 9);
  }

  /**
   * Membuat file KML baru dengan data dari placemark asli dan menambahkan foto
   * @param {Array} placemarks - Array data placemark dari KMZ asli
   * @param {Array} photos - Array data foto
   * @param {String} method - Metode integrasi ('match-name' atau 'sequential')
   * @returns {Document} - Dokumen KML baru
   */
  createNewKML(placemarks, photos, method) {
    // Buat dokumen KML baru dengan struktur minimal
    const kmlDoc = document.implementation.createDocument(null, "kml", null);

    // Tambahkan namespace
    const kmlRoot = kmlDoc.documentElement;
    kmlRoot.setAttribute("xmlns", "http://www.opengis.net/kml/2.2");

    // Buat elemen Document
    const documentEl = kmlDoc.createElement("Document");
    kmlRoot.appendChild(documentEl);

    // Tambahkan nama dokumen
    const docName = kmlDoc.createElement("name");
    docName.textContent = "KMZ Photo Integration";
    documentEl.appendChild(docName);

    // Buat style dasar
    this.createBasicStyles(kmlDoc, documentEl);

    // Buat folder struktur
    const folderEl = kmlDoc.createElement("Folder");
    const folderName = kmlDoc.createElement("name");
    folderName.textContent = "Photos";
    folderEl.appendChild(folderName);
    documentEl.appendChild(folderEl);

    // Tambahkan placemarks dengan foto
    let integratedCount = 0;
    const integratedPhotos = [];

    if (method === "match-name") {
      // Metode integrasi berdasarkan nama
      const result = this.createPlacemarksByName(kmlDoc, folderEl, placemarks, photos);
      integratedCount = result.integratedCount;
      integratedPhotos.push(...result.integratedPhotos);
    } else {
      // Metode integrasi berurutan
      const result = this.createPlacemarksBySequence(kmlDoc, folderEl, placemarks, photos);
      integratedCount = result.integratedCount;
      integratedPhotos.push(...result.integratedPhotos);
    }

    return {kmlDoc, integratedCount, integratedPhotos};
  }

  /**
   * Membuat style dasar untuk KML
   * @param {Document} kmlDoc - Dokumen KML
   * @param {Element} parentElement - Element parent untuk style
   */
  createBasicStyles(kmlDoc, parentElement) {
    // Buat style untuk placemark - sangat minimal
    const style = kmlDoc.createElement("Style");
    style.setAttribute("id", "placemark-style");

    // Icon style - sederhana
    const iconStyle = kmlDoc.createElement("IconStyle");
    const icon = kmlDoc.createElement("Icon");
    const href = kmlDoc.createElement("href");
    href.textContent = "http://maps.google.com/mapfiles/kml/pushpin/ylw-pushpin.png";
    icon.appendChild(href);
    iconStyle.appendChild(icon);
    style.appendChild(iconStyle);

    // Tambahkan style ke dokumen
    parentElement.appendChild(style);
  }

  /**
   * Membuat placemarks berdasarkan kecocokan nama
   * @param {Document} kmlDoc - Dokumen KML
   * @param {Element} parentElement - Element parent untuk placemarks
   * @param {Array} placemarks - Array data placemark dari KMZ asli
   * @param {Array} photos - Array data foto
   * @returns {Object} - Objek berisi integratedCount dan integratedPhotos
   */
  createPlacemarksByName(kmlDoc, parentElement, placemarks, photos) {
    let integratedCount = 0;
    const integratedPhotos = [];
    const placemarkMap = {};

    // Buat map dari placemarks untuk pencarian cepat
    placemarks.forEach((placemark) => {
      // Pastikan hanya placemark dengan awalan "?-" yang diproses
      if (placemark.name.startsWith("?-")) {
        placemarkMap[placemark.name] = placemark;
      }
    });

    // Iterasi melalui foto
    for (const photo of photos) {
      // Ubah nama foto menjadi format "?-xxx" jika belum
      const photoName = photo.name.startsWith("?-") ? photo.name : `?-${photo.name}`;

      if (placemarkMap[photoName]) {
        const placemark = placemarkMap[photoName];

        // Buat nama file simple untuk foto
        const simpleName = `${photoName.replace(/[^a-zA-Z0-9]/g, "")}.jpg`;

        // Buat placemark baru dengan referensi ke file lokal
        const placemarkEl = this.createPlacemarkElement(kmlDoc, placemark, simpleName);
        parentElement.appendChild(placemarkEl);

        // Tambahkan foto ke array integrasi
        integratedPhotos.push({
          photoData: photo,
          fileName: simpleName,
        });

        integratedCount++;
      } else {
        // Coba alternatif: jika nama foto tidak memiliki awalan "?-" tapi ada match
        const altName = photo.name.replace(/^[?]-/, "");
        const matchedPlacemark = Object.values(placemarkMap).find((p) => p.name === `?-${altName}` || p.name.replace(/^[?]-/, "") === altName);

        if (matchedPlacemark) {
          // Buat nama file simple untuk foto berdasarkan nama placemark
          const simpleName = `${matchedPlacemark.name.replace(/[^a-zA-Z0-9]/g, "")}.jpg`;

          // Buat placemark baru dengan referensi ke file lokal
          const placemarkEl = this.createPlacemarkElement(kmlDoc, matchedPlacemark, simpleName);
          parentElement.appendChild(placemarkEl);

          // Tambahkan foto ke array integrasi
          integratedPhotos.push({
            photoData: photo,
            fileName: simpleName,
          });

          integratedCount++;
        }
      }
    }

    return {integratedCount, integratedPhotos};
  }

  /**
   * Membuat placemarks secara berurutan
   * @param {Document} kmlDoc - Dokumen KML
   * @param {Element} parentElement - Element parent untuk placemarks
   * @param {Array} placemarks - Array data placemark dari KMZ asli
   * @param {Array} photos - Array data foto
   * @returns {Object} - Objek berisi integratedCount dan integratedPhotos
   */
  createPlacemarksBySequence(kmlDoc, parentElement, placemarks, photos) {
    // Filter placemarks untuk hanya yang dimulai dengan "?-"
    const filteredPlacemarks = placemarks.filter((p) => p.name.startsWith("?-"));

    const maxCount = Math.min(filteredPlacemarks.length, photos.length);
    const integratedPhotos = [];

    for (let i = 0; i < maxCount; i++) {
      const placemark = filteredPlacemarks[i];
      const photo = photos[i];

      // Buat nama file simple untuk foto
      const simpleName = `${placemark.name.replace(/[^a-zA-Z0-9]/g, "")}.jpg`;

      // Buat placemark baru dengan referensi ke file lokal
      const placemarkEl = this.createPlacemarkElement(kmlDoc, placemark, simpleName);
      parentElement.appendChild(placemarkEl);

      // Tambahkan foto ke array integrasi
      integratedPhotos.push({
        photoData: photo,
        fileName: simpleName,
      });
    }

    return {integratedCount: maxCount, integratedPhotos};
  }

  /**
   * Membuat element placemark dengan referensi gambar lokal
   * @param {Document} kmlDoc - Dokumen KML
   * @param {Object} placemarkData - Data placemark dari KMZ asli
   * @param {String} imageFileName - Nama file gambar
   * @returns {Element} - Element placemark baru
   */
  createPlacemarkElement(kmlDoc, placemarkData, imageFileName) {
    const placemarkEl = kmlDoc.createElement("Placemark");

    // Tambahkan style
    const styleUrl = kmlDoc.createElement("styleUrl");
    styleUrl.textContent = "#placemark-style";
    placemarkEl.appendChild(styleUrl);

    // Tambahkan nama
    const name = kmlDoc.createElement("name");
    name.textContent = placemarkData.name;
    placemarkEl.appendChild(name);

    // Tambahkan deskripsi dengan referensi ke file lokal
    const description = kmlDoc.createElement("description");

    // Buat tag img yang sangat sederhana dengan referensi ke file lokal
    const imgTag = `<img style="max-width:500px;" src="files/${imageFileName}"/>`;

    const cdata = kmlDoc.createCDATASection(imgTag);
    description.appendChild(cdata);
    placemarkEl.appendChild(description);

    // Tambahkan koordinat
    if (placemarkData.coordinates) {
      const point = kmlDoc.createElement("Point");
      const coordinates = kmlDoc.createElement("coordinates");
      coordinates.textContent = `${placemarkData.coordinates.longitude},${placemarkData.coordinates.latitude},${placemarkData.coordinates.altitude}`;
      point.appendChild(coordinates);
      placemarkEl.appendChild(point);
    }

    return placemarkEl;
  }

  /**
   * Membuat file KMZ baru dengan KML dan foto sebagai file terpisah
   * @param {Document} kmlDoc - Dokumen KML baru
   * @param {Array} integratedPhotos - Array objek foto yang terintegrasi
   * @returns {Promise<Blob>} - Promise yang menghasilkan blob KMZ baru
   */
  async createNewKMZ(kmlDoc, integratedPhotos) {
    try {
      // Buat zip baru
      const newZip = new JSZip();

      // Serialisasi dokumen KML
      const serializer = new XMLSerializer();
      const kmlString = serializer.serializeToString(kmlDoc);

      // Tambahkan file KML ke zip
      newZip.file("doc.kml", kmlString);

      // Tambahkan folder untuk gambar
      const imgFolder = newZip.folder("files");

      // Tambahkan semua foto ke folder files
      if (integratedPhotos && integratedPhotos.length > 0) {
        for (const integratedPhoto of integratedPhotos) {
          // Konversi base64 ke Uint8Array
          const binaryData = this.base64ToArrayBuffer(integratedPhoto.photoData.base64Data);

          // Tambahkan file gambar ke folder
          imgFolder.file(integratedPhoto.fileName, binaryData);
        }
      }

      // Buat file KMZ baru
      return await newZip.generateAsync({type: "blob", compression: "DEFLATE"});
    } catch (error) {
      console.error("Error saat membuat KMZ baru:", error);
      throw error;
    }
  }

  /**
   * Konversi string base64 ke ArrayBuffer
   * @param {String} base64 - String Base64
   * @returns {Uint8Array} - Data biner
   */
  base64ToArrayBuffer(base64) {
    const binaryString = window.atob(base64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    return bytes;
  }
}
