/**
 * ArbaConnect ERP - Master Data & Initial State
 * CV Arba'in Solo Raya
 */

window.ArbaData = (function() {
  const products = [
    {
      sku: 'SKU-ARB-MDR500',
      name: "Madu Randu Murni Arba'in 500g",
      category: 'Madu Herbal',
      division: 'Madu & Herbal',
      stock: 1420,
      safetyStock: 180,
      rop: 320,
      ropFormula: 'd=20, L=7d, SS=180 (Konsumsi ~2 Ton/bln)',
      monthlyConsumptionNote: '2,0 Ton / bln (4.000 btl)',
      monthlySoldUnits: 3840,
      forecastNextMonthUnits: 4200,
      activeBatch: 'BATCH-2026-018',
      fefoDate: '18 Okt 2027',
      fefoStatus: 'Aman (>6 Bulan)',
      status: 'optimal',
      unitPrice: 65000,
      icon: 'nutrition'
    },
    {
      sku: 'SKU-ARB-MRB500',
      name: "Madu Rambutan Murni Arba'in 500g",
      category: 'Madu Herbal',
      division: 'Madu & Herbal',
      stock: 145,
      safetyStock: 90,
      rop: 160,
      ropFormula: 'd=10, L=7d, SS=90 (Konsumsi ~1 Ton/bln)',
      monthlyConsumptionNote: '1,0 Ton / bln (2.000 btl)',
      monthlySoldUnits: 1920,
      forecastNextMonthUnits: 2150,
      activeBatch: 'BATCH-2026-029',
      fefoDate: '14 Sep 2027',
      fefoStatus: 'Aman (>6 Bulan)',
      status: 'below-rop',
      unitPrice: 68000,
      icon: 'nutrition'
    },
    {
      sku: 'SKU-ARB-HBT100',
      name: 'Habbatussauda Oil Softgel 100s',
      category: 'Kapsul Herbal',
      division: 'Madu & Herbal',
      stock: 98,
      safetyStock: 120,
      rop: 225,
      ropFormula: 'd=15, L=7d, SS=120',
      monthlyConsumptionNote: '1.450 botol / bln',
      monthlySoldUnits: 1450,
      forecastNextMonthUnits: 1650,
      activeBatch: 'BATCH-2025-084',
      fefoDate: '12 Mei 2026',
      fefoStatus: 'Mendekati ED (<3 Bulan)',
      status: 'below-rop',
      unitPrice: 95000,
      icon: 'vaccines'
    },
    {
      sku: 'SKU-ARB-SKP350',
      name: 'Sari Kurma Plus Propolis 350g',
      category: 'Minyak & Cairan',
      division: 'Madu & Herbal',
      stock: 840,
      safetyStock: 90,
      rop: 160,
      ropFormula: 'd=10, L=7d, SS=90',
      monthlyConsumptionNote: '1.120 botol / bln',
      monthlySoldUnits: 1120,
      forecastNextMonthUnits: 1300,
      activeBatch: 'BATCH-2026-031',
      fefoDate: '30 Nov 2027',
      fefoStatus: 'Aman (>6 Bulan)',
      status: 'optimal',
      unitPrice: 59000,
      icon: 'water_drop'
    },
    {
      sku: 'SKU-ARB-EVO250',
      name: 'Minyak Zaitun Extra Virgin 250ml',
      category: 'Minyak & Cairan',
      division: 'Kosmetik & Perawatan',
      stock: 112,
      safetyStock: 80,
      rop: 140,
      ropFormula: 'd=8, L=7d, SS=80',
      monthlyConsumptionNote: '980 botol / bln',
      monthlySoldUnits: 980,
      forecastNextMonthUnits: 1100,
      activeBatch: 'BATCH-2024-009',
      fefoDate: '14 Mar 2026',
      fefoStatus: 'Kritis (<30 Hari)',
      status: 'critical-expiry',
      unitPrice: 50000,
      icon: 'warning'
    },
    {
      sku: 'SKU-ARB-TML060',
      name: 'Kapsul Temulawak Ekstrak',
      category: 'Kapsul Herbal',
      division: 'Madu & Herbal',
      stock: 650,
      safetyStock: 100,
      rop: 175,
      ropFormula: 'd=10, L=7d, SS=100',
      monthlyConsumptionNote: '860 botol / bln',
      monthlySoldUnits: 860,
      forecastNextMonthUnits: 950,
      activeBatch: 'BATCH-2026-044',
      fefoDate: '19 Des 2027',
      fefoStatus: 'Aman (>6 Bulan)',
      status: 'optimal',
      unitPrice: 48000,
      icon: 'pill'
    },
    {
      sku: 'SKU-ARB-MLT1000',
      name: "Madu Multiflora Arba'in 1kg",
      category: 'Madu Herbal',
      division: 'Madu & Herbal',
      stock: 430,
      safetyStock: 80,
      rop: 150,
      ropFormula: 'd=12, L=7d, SS=80 (Konsumsi ~1,5 Ton/bln)',
      monthlyConsumptionNote: '1,5 Ton / bln (1.500 btl)',
      monthlySoldUnits: 1540,
      forecastNextMonthUnits: 1700,
      activeBatch: 'BATCH-2026-022',
      fefoDate: '15 Jan 2028',
      fefoStatus: 'Aman (>6 Bulan)',
      status: 'optimal',
      unitPrice: 115000,
      icon: 'nutrition'
    },
    {
      sku: 'SKU-ARB-HTN500',
      name: 'Madu Hutan Liar Murni 500g',
      category: 'Madu Herbal',
      division: 'Madu & Herbal',
      stock: 25,
      safetyStock: 40,
      rop: 70,
      ropFormula: 'd=8, L=7d, SS=40',
      monthlyConsumptionNote: '0,6 Ton / bln (1.200 btl)',
      monthlySoldUnits: 1180,
      forecastNextMonthUnits: 1350,
      activeBatch: 'BATCH-2025-110',
      fefoDate: '20 Jul 2026',
      fefoStatus: 'Mendekati ED (<3 Bulan)',
      status: 'below-rop',
      unitPrice: 85000,
      icon: 'nutrition'
    },
    {
      sku: 'SKU-ARB-KSM080',
      name: "Sabun Wajah Herbal Zaitun & Madu Arba'in 80g",
      category: 'Kosmetik Herbal',
      division: 'Kosmetik & Perawatan',
      stock: 520,
      safetyStock: 100,
      rop: 180,
      ropFormula: 'd=11, L=7d, SS=100 (Divisi Kosmetik)',
      monthlyConsumptionNote: '1.320 pcs / bln',
      monthlySoldUnits: 1320,
      forecastNextMonthUnits: 1500,
      activeBatch: 'BATCH-2026-052',
      fefoDate: '10 Nov 2027',
      fefoStatus: 'Aman (>6 Bulan)',
      status: 'optimal',
      unitPrice: 32000,
      icon: 'spa'
    }
  ];

  const ledger = [
    {
      id: 'LEDG-89210',
      timestamp: '25 Feb 2026 • 14:32:05 WIB',
      docRef: 'PO-2026-089',
      skuName: 'Madu Randu 500g',
      skuCode: 'SKU-ARB-MDR500',
      batch: 'BATCH-2026-018',
      type: 'MASUK',
      quantity: 500,
      finalStock: 1420,
      operator: 'Slamet Riadi',
      operatorRole: 'Warehouse Inbound',
      hash: 'c84a...9df2'
    },
    {
      id: 'LEDG-89209',
      timestamp: '25 Feb 2026 • 13:15:42 WIB',
      docRef: 'ORD-ARB-9021',
      skuName: 'Habbatussauda 100s',
      skuCode: 'SKU-ARB-HBT100',
      batch: 'BATCH-2025-084',
      type: 'KELUAR',
      quantity: -60,
      finalStock: 98,
      operator: 'Budi Wicaksono',
      operatorRole: 'Field Sales #FS-04',
      hash: 'e19b...44a7'
    },
    {
      id: 'LEDG-89208',
      timestamp: '25 Feb 2026 • 10:00:11 WIB',
      docRef: 'OPN-2026-Q1-B',
      skuName: 'Kapsul Temulawak',
      skuCode: 'SKU-ARB-TML060',
      batch: 'BATCH-2026-044',
      type: 'PENYESUAIAN',
      quantity: 2,
      finalStock: 650,
      operator: 'Dewi Lestari',
      operatorRole: 'Chief Auditor Intern',
      hash: '7f20...ee13'
    },
    {
      id: 'LEDG-89207',
      timestamp: '24 Feb 2026 • 16:45:19 WIB',
      docRef: 'RMA-2026-014',
      skuName: 'Sari Kurma Propolis',
      skuCode: 'SKU-ARB-SKP350',
      batch: 'BATCH-2026-031',
      type: 'RETUR',
      quantity: 5,
      finalStock: 840,
      operator: 'Ahmad Fauzi',
      operatorRole: 'QC & Return Staff',
      hash: 'a44d...82cb'
    },
    {
      id: 'LEDG-89206',
      timestamp: '24 Feb 2026 • 14:10:00 WIB',
      docRef: 'ORD-ARB-9018',
      skuName: 'Minyak Zaitun 250ml',
      skuCode: 'SKU-ARB-EVO250',
      batch: 'BATCH-2024-009',
      type: 'KELUAR',
      quantity: -40,
      finalStock: 112,
      operator: 'Slamet Riadi',
      operatorRole: 'Warehouse Outbound',
      hash: '38c1...19a0'
    }
  ];

  const outlets = [
    {
      id: 'AP-SLO-001',
      code: 'AP-SLO-001',
      name: 'Apotek Kimia Farma Slamet Riyadi',
      address: 'Jl. Slamet Riyadi No. 248, Laweyan',
      city: 'Solo',
      cityName: 'Surakarta',
      type: 'Jaringan Farmasi',
      picName: 'apt. Nurul Hidayati, S.Farm',
      picRole: 'Apoteker Pengelola Apotek (APA)',
      picPhone: '6281234567890',
      salesRep: 'Budi Santoso',
      salesArea: 'Solo Tengah',
      terms: 'Net 30 Hari',
      creditLimit: 15000000,
      creditUsed: 6750000,
      creditRemaining: 8250000,
      creditStatus: 'Lancar',
      lastOrderDate: '02 Mei 2026',
      orderFrequency: '3x / bulan',
      ytdTotal: 84500000,
      lastVisitDate: '02 Mei 2026, 14:15 WIB',
      visitNotes: '"Kunjungan rutin mingguan oleh Budi Santoso. Display produk Madu Habbatussauda dan Minyak Zaitun Arba\'in di rak depan sudah terpasang rapi. Pemesanan ulang 3 karton varian 250ml berhasil diinput via Mobile PWA. Penagihan faktur tempo 15 Mei sudah dikonfirmasikan ke bagian kasir."'
    },
    {
      id: 'AP-SLO-002',
      code: 'AP-SLO-002',
      name: 'Apotek K-24 UNS Kentingan',
      address: 'Jl. Ir. Sutami No. 36, Jebres, Solo',
      city: 'Solo',
      cityName: 'Surakarta',
      type: 'Jaringan Farmasi',
      picName: 'apt. Rina Marlina, S.Farm',
      picRole: 'Apoteker Pendamping Shift Pagi',
      picPhone: '6281329001122',
      salesRep: 'Anita Rahmawati',
      salesArea: 'Solo Timur & Jebres',
      terms: 'Net 14 Hari',
      creditLimit: 8000000,
      creditUsed: 4200000,
      creditRemaining: 3800000,
      creditStatus: 'Lancar',
      lastOrderDate: '28 Mar 2026',
      orderFrequency: '2x / bulan',
      ytdTotal: 48900000,
      lastVisitDate: '28 Mar 2026, 09:40 WIB',
      visitNotes: '"Pengecekan display produk kapsul temulawak & multiflora 1kg. Rotasi FEFO berjalan lancar, stok kadaluarsa >1 tahun."'
    },
    {
      id: 'MM-SKH-014',
      code: 'MM-SKH-014',
      name: 'Luwes Swalayan Sukoharjo',
      address: 'Jl. Jend. Sudirman No. 89, Gayam',
      city: 'Sukoharjo',
      cityName: 'Sukoharjo',
      type: 'Minimarket',
      picName: 'Bambang S., SE',
      picRole: 'Category Buyer Healthy Drink & Herbal',
      picPhone: '6285712345678',
      salesRep: 'Tri Wahyuni',
      salesArea: 'Sukoharjo-Solo Baru',
      terms: 'Net 14 Hari',
      creditLimit: 25000000,
      creditUsed: 8500000,
      creditRemaining: 16500000,
      creditStatus: 'Lancar',
      lastOrderDate: '29 Apr 2026',
      orderFrequency: '4x / bulan',
      ytdTotal: 112300000,
      lastVisitDate: '29 Apr 2026, 11:30 WIB',
      visitNotes: '"Pemeriksaan FEFO batch kadaluarsa stok Luwes: seluruh stok masa edar >14 bulan (Sangat Baik). Telah disetujui program end-cap gondola promosi awal bulan Juni."'
    },
    {
      id: 'MM-SLO-009',
      code: 'MM-SLO-009',
      name: 'Luwes Gading Minimarket',
      address: 'Jl. Veteran No. 12, Pasar Kliwon, Solo',
      city: 'Solo',
      cityName: 'Surakarta',
      type: 'Minimarket',
      picName: 'Ibu Ratmi (Store Manager)',
      picRole: 'Kepala Toko & Purchasing',
      picPhone: '6281908877665',
      salesRep: 'Budi Santoso',
      salesArea: 'Solo Tengah & Gading',
      terms: 'Net 14 Hari',
      creditLimit: 20000000,
      creditUsed: 12800000,
      creditRemaining: 7200000,
      creditStatus: 'Lancar',
      lastOrderDate: '28 Mar 2026',
      orderFrequency: '3x / bulan',
      ytdTotal: 78400000,
      lastVisitDate: '28 Mar 2026, 09:15 WIB',
      visitNotes: '"Permintaan restock Madu Hutan Liar tinggi. Perlu alokasi substitusi batch dari Gudang B Solo Baru karena stok gudang utama menipis."'
    },
    {
      id: 'AP-KRA-023',
      code: 'AP-KRA-023',
      name: 'Apotek K-24 Karanganyar',
      address: 'Jl. Lawu No. 112, Karanganyar Kota',
      city: 'Karanganyar',
      cityName: 'Karanganyar',
      type: 'Jaringan Farmasi',
      picName: 'apt. Doni Prasetyo',
      picRole: 'Penanggung Jawab Shift Apotek',
      picPhone: '6281398765432',
      salesRep: 'Agus Hermawan',
      salesArea: 'Karanganyar-Palur',
      terms: 'Net 30 Hari',
      creditLimit: 12000000,
      creditUsed: 10200000,
      creditRemaining: 1800000,
      creditStatus: 'Perhatian',
      lastOrderDate: '26 Apr 2026',
      orderFrequency: 'Tempo: 5 hari lagi',
      ytdTotal: 62000000,
      lastVisitDate: '26 Apr 2026, 16:45 WIB',
      visitNotes: '"Faktur #INV-2026-03-882 sebesar Rp 4.200.000 jatuh tempo 5 hari lagi (12 Mei). Pihak finance K-24 telah menjadwalkan transfer pada hari Kamis."'
    },
    {
      id: 'AP-KRA-004',
      code: 'AP-KRA-004',
      name: 'Apotek Sehat Farma Palur',
      address: 'Jl. Raya Palur Km 5, Karanganyar',
      city: 'Karanganyar',
      cityName: 'Karanganyar',
      type: 'Apotek Mandiri',
      picName: 'apt. Sri Wahyuningsih',
      picRole: 'Owner & Apoteker Penanggung Jawab',
      picPhone: '6282245678910',
      salesRep: 'Hadi Kurniawan',
      salesArea: 'Karanganyar-Palur',
      terms: 'COD Cash',
      creditLimit: 5000000,
      creditUsed: 0,
      creditRemaining: 5000000,
      creditStatus: 'Lancar',
      lastOrderDate: '28 Mar 2026',
      orderFrequency: '1x / 2 minggu',
      ytdTotal: 29500000,
      lastVisitDate: '28 Mar 2026, 08:30 WIB',
      visitNotes: '"Pengiriman COD via Driver Joko. Pembayaran tunai saat barang diterima."'
    },
    {
      id: 'AP-BYL-008',
      code: 'AP-BYL-008',
      name: 'Apotek Sehat Mandiri Boyolali',
      address: 'Jl. Pandanaran No. 45, Boyolali',
      city: 'Boyolali',
      cityName: 'Boyolali',
      type: 'Apotek Mandiri',
      picName: 'apt. Ratna Dewi',
      picRole: 'Owner & Apoteker Penanggung Jawab',
      picPhone: '6282133445566',
      salesRep: 'Rian Pratama',
      salesArea: 'Klaten-Boyolali',
      terms: 'Net 14 Hari',
      creditLimit: 8000000,
      creditUsed: 2500000,
      creditRemaining: 5500000,
      creditStatus: 'Lancar',
      lastOrderDate: '01 Mei 2026',
      orderFrequency: '2x / bulan',
      ytdTotal: 41800000,
      lastVisitDate: '01 Mei 2026, 10:20 WIB',
      visitNotes: '"Menerima pengiriman COD reguler 2 karton Madu Arba\'in Propolis. Kondisi kemasan segel utuh dan batch tercatat di ledger gudang."'
    },
    {
      id: 'MM-BYL-003',
      code: 'MM-BYL-003',
      name: 'Minimarket Sumber Rejeki Jaya Boyolali',
      address: 'Jl. Pemuda No. 18, Boyolali Kota',
      city: 'Boyolali',
      cityName: 'Boyolali',
      type: 'Minimarket',
      picName: 'Pak Hadiyanto',
      picRole: 'Manager Operasional Toko',
      picPhone: '6285890123456',
      salesRep: 'Rahmat Adi',
      salesArea: 'Boyolali',
      terms: 'COD Cash',
      creditLimit: 5000000,
      creditUsed: 0,
      creditRemaining: 5000000,
      creditStatus: 'Lancar',
      lastOrderDate: '28 Mar 2026',
      orderFrequency: '2x / bulan',
      ytdTotal: 34100000,
      lastVisitDate: '28 Mar 2026, 16:30 WIB',
      visitNotes: '"Pemesanan repeat order Madu Randu 500g 48 botol. Driver Hartono ditugaskan mengirim via Wave 2."'
    },
    {
      id: 'MM-KLT-005',
      code: 'MM-KLT-005',
      name: 'Toserba Sami Luwes Klaten',
      address: 'Jl. Pemuda No. 70, Klaten Tengah',
      city: 'Klaten',
      cityName: 'Klaten',
      type: 'Minimarket',
      picName: 'Ibu Suryani (Purchasing)',
      picRole: 'Supervisor Purchasing Ritel',
      picPhone: '6287712349988',
      salesRep: 'Rian Pratama',
      salesArea: 'Klaten-Boyolali',
      terms: 'COD Cash',
      creditLimit: 10000000,
      creditUsed: 0,
      creditRemaining: 10000000,
      creditStatus: 'Lancar',
      lastOrderDate: '24 Apr 2026',
      orderFrequency: '1x / 2 minggu',
      ytdTotal: 54000000,
      lastVisitDate: '24 Apr 2026, 13:10 WIB',
      visitNotes: '"Penjualan di rak etalase stabil. Mengambil paket bundling diskon 5% untuk 10 karton."'
    },
    {
      id: 'AP-SRG-019',
      code: 'AP-SRG-019',
      name: 'Apotek Asri Sragen',
      address: 'Jl. Sukowati No. 15, Sragen Kulon',
      city: 'Sragen',
      cityName: 'Sragen',
      type: 'Apotek Mandiri',
      picName: 'apt. Hendra Kusuma',
      picRole: 'Apoteker Pengelola Apotek',
      picPhone: '6281567890123',
      salesRep: 'Agus Hermawan',
      salesArea: 'Karanganyar-Palur-Sragen',
      terms: 'Net 30 Hari',
      creditLimit: 10000000,
      creditUsed: 9800000,
      creditRemaining: 200000,
      creditStatus: 'Overdue',
      lastOrderDate: '15 Mar 2026',
      orderFrequency: 'Overdue 12 hari',
      ytdTotal: 38200000,
      lastVisitDate: '15 Mar 2026, 15:00 WIB',
      visitNotes: '"Tagihan belum terselesaikan karena pergantian rekening bank manajemen apotek. Sales ops telah mengirimkan Surat Pemberitahuan I (SP-1). Pengiriman order baru dibekukan sementara hingga status kredit kembali lancar."'
    },
    {
      id: 'AP-KRA-078',
      code: 'AP-KRA-078',
      name: 'Apotek Kasih Ibu Karanganyar',
      address: 'Jl. Lawu No. 99, Karanganyar',
      city: 'Karanganyar',
      cityName: 'Karanganyar',
      type: 'Apotek Mandiri',
      picName: 'apt. Bambang Sudarsono',
      picRole: 'Apoteker Pengelola Apotek',
      picPhone: '6281233221100',
      salesRep: 'Bambang S.',
      salesArea: 'Karanganyar',
      terms: 'Net 14 Hari',
      creditLimit: 10000000,
      creditUsed: 5750000,
      creditRemaining: 4250000,
      creditStatus: 'Lancar',
      lastOrderDate: '28 Mar 2026',
      orderFrequency: '2x / bulan',
      ytdTotal: 57500000,
      lastVisitDate: '28 Mar 2026, 13:50 WIB',
      visitNotes: '"Pesanan 50 botol Madu Multiflora 1kg disetujui & siap dikirim logistik."'
    }
  ];

  const orders = [
    {
      id: 'ord-7f3b89-20260328',
      clientUuid: 'ord-7f3b89-20260328',
      outletId: 'AP-SLO-001',
      outletName: 'Apotek Kimia Farma Slamet Riyadi',
      address: 'Jl. Slamet Riyadi No. 340, Laweyan, Surakarta',
      city: 'Surakarta',
      salesRep: 'Budi Santoso',
      salesRepId: 'REP-SR-04',
      orderTime: 'Hari ini, 10:14 WIB (7 menit lalu)',
      orderTimestamp: Date.now() - 7 * 60 * 1000,
      totalAmount: 8450000,
      terms: 'Net 30 Hari',
      limitMax: 15000000,
      limitRemaining: 6550000,
      geofenceValid: true,
      geofenceCoords: '-7.5583, 110.8214 (Presisi)',
      npwp: '01.324.891.4-528.000',
      status: 'PENDING',
      syncStatus: 'SYNCED_DEDUCTED',
      priority: 'High',
      items: [
        {
          sku: 'SKU-ARB-MDR500',
          name: "Madu Randu Murni 500g",
          batch: 'Batch: B-2026-018',
          expiry: '14 Des 2027',
          fefoPriority: 'FEFO Prioritas 1',
          quantity: 40,
          unitPrice: 65000,
          subtotal: 2600000,
          allocated: true,
          remainingBatchStock: 340
        },
        {
          sku: 'SKU-ARB-HBT100',
          name: 'Habbatussauda Softgel 100s',
          batch: 'Batch: B-2026-009',
          expiry: '22 Agu 2027',
          fefoPriority: 'FEFO Prioritas 1',
          quantity: 30,
          unitPrice: 95000,
          subtotal: 2850000,
          allocated: true,
          remainingBatchStock: 180
        },
        {
          sku: 'SKU-ARB-EVO250',
          name: 'Minyak Zaitun Extra Virgin 250ml',
          batch: 'Batch: B-2026-031',
          expiry: '05 Jan 2028',
          fefoPriority: 'FEFO Prioritas 1',
          quantity: 20,
          unitPrice: 50000,
          subtotal: 1000000,
          allocated: true,
          remainingBatchStock: 215
        }
      ]
    },
    {
      id: 'ord-92a10c-20260328',
      clientUuid: 'ord-92a10c-20260328',
      outletId: 'AP-SLO-002',
      outletName: 'Apotek K-24 UNS Kentingan',
      address: 'Jl. Ir. Sutami No. 36, Jebres, Solo',
      city: 'Surakarta',
      salesRep: 'Anita Rahmawati',
      salesRepId: 'REP-SKH-02',
      orderTime: 'Hari ini, 09:58 WIB (25 menit lalu)',
      orderTimestamp: Date.now() - 25 * 60 * 1000,
      totalAmount: 4200000,
      terms: 'Net 14 Hari',
      limitMax: 8000000,
      limitRemaining: 3800000,
      geofenceValid: true,
      geofenceCoords: '-7.5592, 110.8550 (Presisi)',
      npwp: '02.482.119.5-528.000',
      status: 'PENDING',
      syncStatus: 'SYNCED_DEDUCTED',
      priority: 'Normal',
      items: [
        {
          sku: 'SKU-ARB-MLT1000',
          name: "Madu Multiflora 1kg",
          batch: 'Batch: B-2026-022',
          expiry: '15 Jan 2028',
          fefoPriority: 'FEFO Prioritas 1',
          quantity: 20,
          unitPrice: 115000,
          subtotal: 2300000,
          allocated: true,
          remainingBatchStock: 410
        },
        {
          sku: 'SKU-ARB-HBT100',
          name: 'Habbatussauda Softgel 100s',
          batch: 'Batch: B-2026-010',
          expiry: '10 Sep 2027',
          fefoPriority: 'FEFO Prioritas 1',
          quantity: 20,
          unitPrice: 95000,
          subtotal: 1900000,
          allocated: true,
          remainingBatchStock: 160
        }
      ]
    },
    {
      id: 'ord-48e02d-20260328',
      clientUuid: 'ord-48e02d-20260328',
      outletId: 'MM-SLO-009',
      outletName: 'Luwes Gading Minimarket',
      address: 'Jl. Veteran No. 12, Pasar Kliwon, Solo',
      city: 'Surakarta',
      salesRep: 'Budi Santoso',
      salesRepId: 'REP-SR-04',
      orderTime: 'Hari ini, 09:32 WIB (50 menit lalu)',
      orderTimestamp: Date.now() - 50 * 60 * 1000,
      totalAmount: 12800000,
      terms: 'Net 14 Hari',
      limitMax: 20000000,
      limitRemaining: 7200000,
      geofenceValid: true,
      geofenceCoords: '-7.5750, 110.8280 (Presisi)',
      npwp: '03.882.441.9-528.000',
      status: 'PENDING',
      syncStatus: 'PENDING_WAREHOUSE',
      priority: 'High',
      stockWarning: 'Stok SKU Madu Hutan 500g menipis (Kurang 15 unit)',
      items: [
        {
          sku: 'SKU-ARB-HTN500',
          name: 'Madu Hutan Liar Murni 500g',
          batch: 'Batch: B-2025-110',
          expiry: '20 Jul 2026',
          fefoPriority: 'FEFO Menipis',
          quantity: 40,
          unitPrice: 85000,
          subtotal: 3400000,
          allocated: false,
          remainingBatchStock: 25
        },
        {
          sku: 'SKU-ARB-MDR500',
          name: "Madu Randu Murni 500g",
          batch: 'Batch: B-2026-018',
          expiry: '14 Des 2027',
          fefoPriority: 'FEFO Prioritas 1',
          quantity: 100,
          unitPrice: 65000,
          subtotal: 6500000,
          allocated: true,
          remainingBatchStock: 240
        },
        {
          sku: 'SKU-ARB-EVO250',
          name: 'Minyak Zaitun Extra Virgin 250ml',
          batch: 'Batch: B-2026-031',
          expiry: '05 Jan 2028',
          fefoPriority: 'FEFO Prioritas 1',
          quantity: 58,
          unitPrice: 50000,
          subtotal: 2900000,
          allocated: true,
          remainingBatchStock: 157
        }
      ]
    },
    {
      id: 'ord-11c56f-20260328',
      clientUuid: 'ord-11c56f-20260328',
      outletId: 'AP-KRA-004',
      outletName: 'Apotek Sehat Farma Palur',
      address: 'Jl. Raya Palur Km 5, Karanganyar',
      city: 'Karanganyar',
      salesRep: 'Hadi Kurniawan',
      salesRepId: 'REP-KRA-01',
      orderTime: 'Hari ini, 08:45 WIB (1j 35m lalu)',
      orderTimestamp: Date.now() - 95 * 60 * 1000,
      totalAmount: 2950000,
      terms: 'COD Tunai (Driver: Joko)',
      limitMax: 5000000,
      limitRemaining: 5000000,
      geofenceValid: true,
      geofenceCoords: '-7.5610, 110.8710 (Presisi)',
      npwp: '04.192.831.2-528.000',
      status: 'PENDING',
      syncStatus: 'SYNCED_DEDUCTED',
      priority: 'Normal',
      items: [
        {
          sku: 'SKU-ARB-SKP350',
          name: 'Sari Kurma Plus Propolis 350g',
          batch: 'Batch: B-2026-031',
          expiry: '30 Nov 2027',
          fefoPriority: 'FEFO Prioritas 1',
          quantity: 50,
          unitPrice: 59000,
          subtotal: 2950000,
          allocated: true,
          remainingBatchStock: 790
        }
      ]
    },
    {
      id: 'ord-88c2f-20260328',
      clientUuid: 'ord-88c2f-20260328',
      outletId: 'MM-BYL-003',
      outletName: 'Minimarket Sumber Rejeki Jaya',
      address: 'Jl. Pemuda No. 18, Boyolali Kota',
      city: 'Boyolali',
      salesRep: 'Rahmat Adi',
      salesRepId: 'REP-BYL-03',
      orderTime: '16:45 WIB (45m lalu)',
      orderTimestamp: Date.now() - 45 * 60 * 1000,
      totalAmount: 3120000,
      terms: 'COD Tunai',
      limitMax: 5000000,
      limitRemaining: 5000000,
      geofenceValid: true,
      geofenceCoords: '-7.5312, 110.5982 (Presisi)',
      npwp: '05.991.228.1-528.000',
      status: 'PENDING',
      syncStatus: 'PENDING_WAREHOUSE',
      priority: 'Normal',
      items: [
        {
          sku: 'SKU-ARB-MDR500',
          name: "Madu Randu Murni 500g",
          batch: 'Batch: B-2026-018',
          expiry: '14 Des 2027',
          fefoPriority: 'FEFO Prioritas 1',
          quantity: 48,
          unitPrice: 65000,
          subtotal: 3120000,
          allocated: true,
          remainingBatchStock: 340
        }
      ]
    },
    {
      id: 'ord-fe54a-20260328',
      clientUuid: 'ord-fe54a-20260328',
      outletId: 'AP-KRA-078',
      outletName: 'Apotek Kasih Ibu Karanganyar',
      address: 'Jl. Lawu No. 99, Karanganyar',
      city: 'Karanganyar',
      salesRep: 'Bambang S.',
      salesRepId: 'REP-KRA-02',
      orderTime: '14:10 WIB (3j 20m lalu)',
      orderTimestamp: Date.now() - 200 * 60 * 1000,
      totalAmount: 5750000,
      terms: 'Net 14 Hari',
      limitMax: 10000000,
      limitRemaining: 4250000,
      geofenceValid: true,
      geofenceCoords: '-7.5991, 110.9501 (Presisi)',
      npwp: '06.331.002.3-528.000',
      status: 'APPROVED',
      syncStatus: 'SYNCED_DEDUCTED',
      priority: 'Normal',
      items: [
        {
          sku: 'SKU-ARB-MLT1000',
          name: "Madu Multiflora 1kg",
          batch: 'Batch: B-2026-022',
          expiry: '15 Jan 2028',
          fefoPriority: 'FEFO Prioritas 1',
          quantity: 50,
          unitPrice: 115000,
          subtotal: 5750000,
          allocated: true,
          remainingBatchStock: 360
        }
      ]
    }
  ];

  const supplierPOs = [
    {
      id: 'PO-SUPP-2026-001',
      sku: 'SKU-ARB-HBT100',
      productName: 'Habbatussauda Oil Softgel 100s',
      vendorName: 'CV Sumber Herbal Barokah Solo',
      quantity: 300,
      unitPrice: 55000,
      totalCost: 16500000,
      leadTimeDays: 7,
      expectedDate: '04 Apr 2026',
      status: 'DALAM_PRODUKSI',
      createdAt: '28 Mar 2026, 09:00 WIB'
    }
  ];

  const salesVisits = [
    {
      id: 'VISIT-001',
      outletId: 'AP-SLO-001',
      outletName: 'Apotek Kimia Farma Slamet Riyadi',
      salesRep: 'Budi Santoso',
      scheduledDate: '2026-04-02T10:00',
      purpose: 'Kunjungan Rutin',
      notes: 'Pengecekan display etalase depan dan follow-up pemesanan paket 3 varian',
      status: 'TERJADWAL'
    },
    {
      id: 'VISIT-002',
      outletId: 'AP-KRA-023',
      outletName: 'Apotek K-24 Karanganyar',
      salesRep: 'Agus Hermawan',
      scheduledDate: '2026-04-03T14:00',
      purpose: 'Penagihan Tempo',
      notes: 'Faktur tempo 12 Mei dan pengantaran faktur pajak asli',
      status: 'TERJADWAL'
    }
  ];

  const driverManifests = [
    {
      driverName: 'Joko Susilo',
      vehiclePlate: 'AD-8941-KA (GranMax Box)',
      routeArea: 'Solo Tengah & Laweyan',
      wave: 'Wave 1 (08:00 - 12:00 WIB)',
      totalOutlets: 8,
      orders: [
        {
          orderId: 'ord-7f3b89-20260328',
          outletName: 'Apotek Kimia Farma Slamet Riyadi',
          address: 'Jl. Slamet Riyadi No. 340, Laweyan',
          amount: 8450000,
          delivered: false
        },
        {
          orderId: 'ord-fe54a-20260328',
          outletName: 'Apotek Kasih Ibu Karanganyar',
          address: 'Jl. Lawu No. 99, Karanganyar',
          amount: 5750000,
          delivered: true,
          deliveredTime: '10:35 WIB'
        }
      ]
    },
    {
      driverName: 'Hartono Prabowo',
      vehiclePlate: 'AD-1044-YB (BlindVan)',
      routeArea: 'Sukoharjo & Solo Baru',
      wave: 'Wave 2 (13:00 - 17:00 WIB)',
      totalOutlets: 6,
      orders: [
        {
          orderId: 'ord-88c2f-20260328',
          outletName: 'Minimarket Sumber Rejeki Jaya',
          address: 'Jl. Pemuda No. 18, Boyolali',
          amount: 3120000,
          delivered: false
        }
      ]
    }
  ];

  // ---------------------------------------------------------------------------
  // Enrich setiap outlet dengan Skema Konsinyasi (>90% Titip Jual) & Stok Titipan
  // per Apotek (mencakup produk LARIS, LAMA_TIDAK_LAKU, dan HAMPIR_EXPIRED).
  // Sesuai hasil wawancara CV Arba'in:
  // - "Hampir 90% lebih titip jual... Apotek itu pasif, kita kunjungi: apa yang
  //    terjual, dia bayar, terus kita ngasih stok baru, kuitansinya kita ganti."
  // - "Sampai saat ini kita enggak tahu apotek A itu berapa barangnya... kalau
  //    ada alarm produk hampir expired, oh ternyata di apotek sana, sales ngasih
  //    tahu: Mbak, tolong yang dijual ini dulu."
  // - "Kaitannya dengan stok yang ada di apotek itu yang laku apa, yang lama
  //    enggak laku apa."
  // ---------------------------------------------------------------------------
  outlets.forEach(function (o, idx) {
    // >90% outlet menggunakan sistem Konsinyasi (Titip Jual), sisanya Jatuh Tempo / Cash
    if (idx === 2) {
      o.terms = 'Jatuh Tempo (Net 14 Hari)';
      o.partnershipModel = 'Jatuh Tempo';
    } else if (idx === 8) {
      o.terms = 'Cash / Tunai di Awal';
      o.partnershipModel = 'Cash di Awal';
    } else {
      o.terms = 'Konsinyasi (Titip Jual)';
      o.partnershipModel = 'Konsinyasi (Titip Jual)';
    }

    const sampleSets = [
      [
        { sku: 'SKU-ARB-MDR500', name: "Madu Randu Murni Arba'in 500g", batch: 'BATCH-2026-018', expiry: '18 Okt 2027', consignedQty: 30, soldQty: 22, remainingQty: 8, unitPrice: 65000, velocity: 'LARIS', daysInOutlet: 14, nearExpiry: false },
        { sku: 'SKU-ARB-HBT100', name: 'Habbatussauda Oil Softgel 100s', batch: 'BATCH-2025-084', expiry: '12 Mei 2026', consignedQty: 20, soldQty: 12, remainingQty: 8, unitPrice: 95000, velocity: 'LARIS', daysInOutlet: 42, nearExpiry: true },
        { sku: 'SKU-ARB-EVO250', name: 'Minyak Zaitun Extra Virgin 250ml', batch: 'BATCH-2024-009', expiry: '14 Mar 2026', consignedQty: 15, soldQty: 3, remainingQty: 12, unitPrice: 50000, velocity: 'LAMA_TIDAK_LAKU', daysInOutlet: 78, nearExpiry: true }
      ],
      [
        { sku: 'SKU-ARB-MLT1000', name: "Madu Multiflora Arba'in 1kg", batch: 'BATCH-2026-022', expiry: '15 Jan 2028', consignedQty: 24, soldQty: 19, remainingQty: 5, unitPrice: 115000, velocity: 'LARIS', daysInOutlet: 18, nearExpiry: false },
        { sku: 'SKU-ARB-MRB500', name: "Madu Rambutan Murni Arba'in 500g", batch: 'BATCH-2026-029', expiry: '14 Sep 2027', consignedQty: 20, soldQty: 15, remainingQty: 5, unitPrice: 68000, velocity: 'LARIS', daysInOutlet: 21, nearExpiry: false },
        { sku: 'SKU-ARB-TML060', name: 'Kapsul Temulawak Ekstrak', batch: 'BATCH-2025-071', expiry: '28 Apr 2026', consignedQty: 18, soldQty: 2, remainingQty: 16, unitPrice: 48000, velocity: 'LAMA_TIDAK_LAKU', daysInOutlet: 85, nearExpiry: true }
      ],
      [
        { sku: 'SKU-ARB-MDR500', name: "Madu Randu Murni Arba'in 500g", batch: 'BATCH-2026-018', expiry: '18 Okt 2027', consignedQty: 40, soldQty: 34, remainingQty: 6, unitPrice: 65000, velocity: 'LARIS', daysInOutlet: 12, nearExpiry: false },
        { sku: 'SKU-ARB-KSM080', name: "Sabun Wajah Herbal Zaitun & Madu Arba'in 80g", batch: 'BATCH-2026-052', expiry: '10 Nov 2027', consignedQty: 25, soldQty: 18, remainingQty: 7, unitPrice: 32000, velocity: 'LARIS', daysInOutlet: 19, nearExpiry: false },
        { sku: 'SKU-ARB-HTN500', name: 'Madu Hutan Liar Murni 500g', batch: 'BATCH-2025-110', expiry: '20 Jul 2026', consignedQty: 12, soldQty: 2, remainingQty: 10, unitPrice: 85000, velocity: 'LAMA_TIDAK_LAKU', daysInOutlet: 64, nearExpiry: true }
      ]
    ];

    o.consignmentItems = JSON.parse(JSON.stringify(sampleSets[idx % sampleSets.length]));
    o.consignmentTotalUnits = o.consignmentItems.reduce(function (s, it) { return s + it.remainingQty; }, 0);
    o.consignmentBillableAmount = o.consignmentItems.reduce(function (s, it) { return s + it.soldQty * it.unitPrice; }, 0);
  });

  // ---------------------------------------------------------------------------
  // Tim Sales Lapangan & Target Capaian (entitas `sales_targets`)
  // Sesuai wawancara CV Arba'in:
  // - Pembagian divisi sales: Sales Madu & Herbal vs Sales Kosmetik Herbal
  // - Target keliling harian: 15 outlet / hari ("Taruhlah hari ini target kita 15 outlet")
  // ---------------------------------------------------------------------------
  const salesTeam = [
    { id: 'REP-SR-04',  name: 'Budi Santoso',    division: 'Madu & Herbal',        area: 'Solo Tengah & Laweyan', dailyVisitTarget: 15, monthlyRevenueTarget: 95000000, monthlyRevenueBase: 71200000, monthlyVisitBase: 285 },
    { id: 'REP-SKH-02', name: 'Anita Rahmawati', division: 'Kosmetik & Perawatan', area: 'Jebres & Sukoharjo',    dailyVisitTarget: 15, monthlyRevenueTarget: 70000000, monthlyRevenueBase: 58400000, monthlyVisitBase: 268 },
    { id: 'REP-SKH-05', name: 'Tri Wahyuni',     division: 'Madu & Herbal',        area: 'Sukoharjo & Solo Baru', dailyVisitTarget: 15, monthlyRevenueTarget: 60000000, monthlyRevenueBase: 49750000, monthlyVisitBase: 254 },
    { id: 'REP-KRA-03', name: 'Agus Hermawan',   division: 'Madu & Herbal',        area: 'Karanganyar Kota',      dailyVisitTarget: 15, monthlyRevenueTarget: 60000000, monthlyRevenueBase: 38900000, monthlyVisitBase: 230 },
    { id: 'REP-KRA-01', name: 'Hadi Kurniawan',  division: 'Kosmetik & Perawatan', area: 'Palur & Karanganyar',   dailyVisitTarget: 15, monthlyRevenueTarget: 50000000, monthlyRevenueBase: 41300000, monthlyVisitBase: 242 },
    { id: 'REP-KLT-01', name: 'Rian Pratama',    division: 'Madu & Herbal',        area: 'Klaten & Sragen',       dailyVisitTarget: 15, monthlyRevenueTarget: 55000000, monthlyRevenueBase: 46100000, monthlyVisitBase: 248 },
    { id: 'REP-BYL-03', name: 'Rahmat Adi',      division: 'Madu & Herbal',        area: 'Boyolali',              dailyVisitTarget: 15, monthlyRevenueTarget: 50000000, monthlyRevenueBase: 39600000, monthlyVisitBase: 235 },
    { id: 'REP-KRA-02', name: 'Bambang S.',      division: 'Kosmetik & Perawatan', area: 'Karanganyar Timur',     dailyVisitTarget: 15, monthlyRevenueTarget: 45000000, monthlyRevenueBase: 35800000, monthlyVisitBase: 220 }
  ];

  // ---------------------------------------------------------------------------
  // Kontrol Barang Bawaan Sales dari Gudang (Canvas Loading vs Unloading)
  // Sesuai kutipan wawancara CV Arba'in:
  // "Seandainya sales kita nakal, bawa dari gudang itu 15, yang 3 dijual kantong
  //  sendiri, yang 12 masuk kantor, kita enggak tahu, Mas... Mulai nyatatnya itu
  //  saat sales ngambil dari warehouse-nya... Saat kembali, dicatat juga saat
  //  pengembalian produknya."
  // ---------------------------------------------------------------------------
  const salesLoadings = [
    {
      id: 'LOAD-2026-041',
      date: 'Hari ini • Pukul 07:45 WIB',
      salesRep: 'Budi Santoso',
      salesRepId: 'REP-SR-04',
      division: 'Madu & Herbal',
      routeArea: 'Solo Tengah & Laweyan (Target 15 Outlet)',
      status: 'SEDANG_KELILING',
      cashCollected: 4850000,
      items: [
        { sku: 'SKU-ARB-MDR500', name: "Madu Randu Murni Arba'in 500g", batch: 'BATCH-2026-018', loadedQty: 60, droppedQty: 42, returnedQty: 18, discrepancy: 0, unitPrice: 65000 },
        { sku: 'SKU-ARB-MRB500', name: "Madu Rambutan Murni Arba'in 500g", batch: 'BATCH-2026-029', loadedQty: 30, droppedQty: 22, returnedQty: 8, discrepancy: 0, unitPrice: 68000 },
        { sku: 'SKU-ARB-HBT100', name: 'Habbatussauda Oil Softgel 100s', batch: 'BATCH-2025-084', loadedQty: 25, droppedQty: 18, returnedQty: 7, discrepancy: 0, unitPrice: 95000 }
      ]
    },
    {
      id: 'LOAD-2026-042',
      date: 'Hari ini • Pukul 07:50 WIB',
      salesRep: 'Anita Rahmawati',
      salesRepId: 'REP-SKH-02',
      division: 'Kosmetik & Perawatan',
      routeArea: 'Jebres & Sukoharjo (Target 15 Outlet)',
      status: 'TERVERIFIKASI_KLOP',
      cashCollected: 3620000,
      items: [
        { sku: 'SKU-ARB-KSM080', name: "Sabun Wajah Herbal Zaitun & Madu Arba'in 80g", batch: 'BATCH-2026-052', loadedQty: 50, droppedQty: 38, returnedQty: 12, discrepancy: 0, unitPrice: 32000 },
        { sku: 'SKU-ARB-EVO250', name: 'Minyak Zaitun Extra Virgin 250ml', batch: 'BATCH-2024-009', loadedQty: 30, droppedQty: 24, returnedQty: 6, discrepancy: 0, unitPrice: 50000 }
      ]
    },
    {
      id: 'LOAD-2026-043',
      date: 'Hari ini • Pukul 08:00 WIB',
      salesRep: 'Agus Hermawan',
      salesRepId: 'REP-KRA-03',
      division: 'Madu & Herbal',
      routeArea: 'Karanganyar Kota (Target 15 Outlet)',
      status: 'SELISIH_AUDIT',
      cashCollected: 2940000,
      auditNote: 'Bawa 15 karton/botol Madu Hutan dari gudang: tercatat masuk kantor 12, selisih 3 unit belum kembali ke gudang!',
      items: [
        { sku: 'SKU-ARB-HTN500', name: 'Madu Hutan Liar Murni 500g', batch: 'BATCH-2025-110', loadedQty: 15, droppedQty: 12, returnedQty: 0, discrepancy: 3, unitPrice: 85000 },
        { sku: 'SKU-ARB-MDR500', name: "Madu Randu Murni Arba'in 500g", batch: 'BATCH-2026-018', loadedQty: 40, droppedQty: 30, returnedQty: 10, discrepancy: 0, unitPrice: 65000 }
      ]
    }
  ];

  // ---------------------------------------------------------------------------
  // Log Kunjungan Lapangan (entitas `visits`) — check-in GPS + hasil kunjungan.
  // ---------------------------------------------------------------------------
  const visitLogs = (function () {
    const plan = [
      ['Budi Santoso', 13], ['Anita Rahmawati', 12], ['Tri Wahyuni', 11], ['Agus Hermawan', 9],
      ['Hadi Kurniawan', 11], ['Rian Pratama', 12], ['Rahmat Adi', 10], ['Bambang S.', 10]
    ];
    const outcomes = ['ORDER', 'ORDER', 'COLLECTION', 'ORDER', 'NO_ORDER_STOCK_FULL', 'ORDER', 'FOLLOW_UP', 'ORDER'];
    const logs = [];
    const dayStart = new Date();
    dayStart.setHours(0, 1, 0, 0);
    const total = plan.reduce(function (s, p) { return s + p[1]; }, 0);
    let n = 0;
    plan.forEach(function (p) {
      for (let i = 0; i < p[1]; i++) {
        const outlet = outlets[(n * 3 + i) % outlets.length];
        logs.push({
          id: 'VLOG-' + String(1000 + n),
          salesRep: p[0],
          outletId: outlet.id,
          outletName: outlet.name,
          timestamp: Math.max(dayStart.getTime() + n * 1000, Date.now() - (total - n) * 5 * 60 * 1000),
          outcome: outcomes[n % outcomes.length],
          gpsDistance: 6 + (n * 5) % 15,
          notes: 'Kunjungan audit konsinyasi & tagihan rutin',
          orderId: null
        });
        n++;
      }
    });
    return logs;
  })();

  // Baseline historis jumlah outlet konsinyasi (> 1.000 outlet: Apotek, Minimarket, Toko Obat)
  // Sesuai wawancara CV Arba'in: "Offline kita, toko kita banyak, lebih dari 1.000... Kita cuman nitip di situ, namanya konsinyasi"
  const baseline = {
    extraApotek: 684 - outlets.filter(function (o) { return o.type !== 'Minimarket'; }).length,
    extraMinimarket: 340 - outlets.filter(function (o) { return o.type === 'Minimarket'; }).length
  };

  // ---------------------------------------------------------------------------
  // Master Akun Pengguna & Kredensial RBAC (Mendukung Login Online & Offline)
  // ---------------------------------------------------------------------------
  const users = [
    {
      id: 'USR-SUPER-01',
      name: 'Farid Super Administrator',
      username: 'superadmin',
      email: 'superadmin@arbain.co.id',
      phone: '081122334455',
      password: 'admin123',
      pin: '123456',
      role: 'super-admin',
      sqlRole: 'super_admin',
      title: 'Super Administrator IT & ERP',
      division: 'Pusat Kendali Sistem & Hak Akses (All Access)',
      avatarInitials: 'SA',
      badgeColor: '#be123c',
      active: true,
      defaultPath: 'user-management',
      permissions: [
        'executive-dashboard',
        'inventory-stock-ledger',
        'b2b-crm-directory',
        'order-approval-queue',
        'field-sales-pwa-preview',
        'user-management',
        'user-profile-settings'
      ]
    },
    {
      id: 'USR-DIR-01',
      name: 'H. Ahmad Zaini, S.E.',
      username: 'direktur',
      email: 'direktur@arbain.co.id',
      phone: '081226001100',
      password: '123',
      pin: '123456',
      role: 'executive',
      sqlRole: 'direktur',
      title: 'Direktur Operasional',
      division: 'Manajemen Eksekutif CV Arba\'in',
      avatarInitials: 'AZ',
      badgeColor: '#005c55',
      active: true,
      defaultPath: 'executive-dashboard',
      permissions: [
        'executive-dashboard',
        'inventory-stock-ledger',
        'b2b-crm-directory',
        'order-approval-queue',
        'user-profile-settings'
      ]
    },
    {
      id: 'USR-WH-01',
      name: 'Slamet Riadi',
      username: 'gudang',
      email: 'gudang@arbain.co.id',
      phone: '081329002211',
      password: '123',
      pin: '123456',
      role: 'inventory',
      sqlRole: 'admin_gudang',
      title: 'Kepala Gudang Kartasura',
      division: 'Logistik, Batch FEFO & Anti-Fraud',
      avatarInitials: 'SR',
      badgeColor: '#0284c7',
      active: true,
      defaultPath: 'inventory-stock-ledger',
      permissions: [
        'inventory-stock-ledger',
        'order-approval-queue',
        'user-profile-settings'
      ]
    },
    {
      id: 'USR-OPS-01',
      name: 'Dewi Sartika, S.Ak.',
      username: 'adminsales',
      email: 'salesops@arbain.co.id',
      phone: '081567003322',
      password: '123',
      pin: '123456',
      role: 'sales-ops',
      sqlRole: 'admin_penjualan',
      title: 'Koordinator Admin Penjualan',
      division: 'Verifikasi Faktur & Kredit B2B',
      avatarInitials: 'DS',
      badgeColor: '#7c3aed',
      active: true,
      defaultPath: 'order-approval-queue',
      permissions: [
        'order-approval-queue',
        'b2b-crm-directory',
        'user-profile-settings'
      ]
    },
    {
      id: 'REP-SR-04',
      name: 'Budi Santoso',
      username: 'budi',
      email: 'budi.santoso@arbain.co.id',
      phone: '081234567801',
      password: '123',
      pin: '123456',
      role: 'field-sales',
      sqlRole: 'sales',
      salesRepName: 'Budi Santoso',
      salesRepId: 'REP-SR-04',
      title: 'Field Sales Representative',
      division: 'Divisi Madu & Herbal (Solo Tengah)',
      avatarInitials: 'BS',
      badgeColor: '#d97706',
      active: true,
      defaultPath: 'field-sales-pwa-preview',
      permissions: ['field-sales-pwa-preview', 'b2b-crm-directory', 'user-profile-settings']
    },
    {
      id: 'REP-SKH-02',
      name: 'Anita Rahmawati',
      username: 'anita',
      email: 'anita.rahmawati@arbain.co.id',
      phone: '081234567802',
      password: '123',
      pin: '123456',
      role: 'field-sales',
      sqlRole: 'sales',
      salesRepName: 'Anita Rahmawati',
      salesRepId: 'REP-SKH-02',
      title: 'Field Sales Representative',
      division: 'Divisi Kosmetik & Perawatan (Jebres & Sukoharjo)',
      avatarInitials: 'AR',
      badgeColor: '#db2777',
      active: true,
      defaultPath: 'field-sales-pwa-preview',
      permissions: ['field-sales-pwa-preview', 'b2b-crm-directory', 'user-profile-settings']
    },
    {
      id: 'REP-KRA-03',
      name: 'Agus Hermawan',
      username: 'agus',
      email: 'agus.hermawan@arbain.co.id',
      phone: '081234567803',
      password: '123',
      pin: '123456',
      role: 'field-sales',
      sqlRole: 'sales',
      salesRepName: 'Agus Hermawan',
      salesRepId: 'REP-KRA-03',
      title: 'Field Sales Representative',
      division: 'Divisi Madu & Herbal (Karanganyar Kota)',
      avatarInitials: 'AH',
      badgeColor: '#ea580c',
      active: true,
      defaultPath: 'field-sales-pwa-preview',
      permissions: ['field-sales-pwa-preview', 'b2b-crm-directory', 'user-profile-settings']
    },
    {
      id: 'REP-SKH-05',
      name: 'Tri Wahyuni',
      username: 'tri',
      email: 'tri.wahyuni@arbain.co.id',
      phone: '081234567804',
      password: '123',
      pin: '123456',
      role: 'field-sales',
      sqlRole: 'sales',
      salesRepName: 'Tri Wahyuni',
      salesRepId: 'REP-SKH-05',
      title: 'Field Sales Representative',
      division: 'Divisi Madu & Herbal (Sukoharjo & Solo Baru)',
      avatarInitials: 'TW',
      badgeColor: '#059669',
      active: true,
      defaultPath: 'field-sales-pwa-preview',
      permissions: ['field-sales-pwa-preview', 'b2b-crm-directory', 'user-profile-settings']
    },
    {
      id: 'REP-KRA-01',
      name: 'Hadi Kurniawan',
      username: 'hadi',
      email: 'hadi.kurniawan@arbain.co.id',
      phone: '081234567805',
      password: '123',
      pin: '123456',
      role: 'field-sales',
      sqlRole: 'sales',
      salesRepName: 'Hadi Kurniawan',
      salesRepId: 'REP-KRA-01',
      title: 'Field Sales Representative',
      division: 'Divisi Kosmetik & Perawatan (Palur & Karanganyar)',
      avatarInitials: 'HK',
      badgeColor: '#0284c7',
      active: true,
      defaultPath: 'field-sales-pwa-preview',
      permissions: ['field-sales-pwa-preview', 'b2b-crm-directory', 'user-profile-settings']
    },
    {
      id: 'REP-KLT-01',
      name: 'Rian Pratama',
      username: 'rian',
      email: 'rian.pratama@arbain.co.id',
      phone: '081234567806',
      password: '123',
      pin: '123456',
      role: 'field-sales',
      sqlRole: 'sales',
      salesRepName: 'Rian Pratama',
      salesRepId: 'REP-KLT-01',
      title: 'Field Sales Representative',
      division: 'Divisi Madu & Herbal (Klaten & Sragen)',
      avatarInitials: 'RP',
      badgeColor: '#4f46e5',
      active: true,
      defaultPath: 'field-sales-pwa-preview',
      permissions: ['field-sales-pwa-preview', 'b2b-crm-directory', 'user-profile-settings']
    },
    {
      id: 'REP-BYL-03',
      name: 'Rahmat Adi',
      username: 'rahmat',
      email: 'rahmat.adi@arbain.co.id',
      phone: '081234567807',
      password: '123',
      pin: '123456',
      role: 'field-sales',
      sqlRole: 'sales',
      salesRepName: 'Rahmat Adi',
      salesRepId: 'REP-BYL-03',
      title: 'Field Sales Representative',
      division: 'Divisi Madu & Herbal (Boyolali)',
      avatarInitials: 'RA',
      badgeColor: '#0d9488',
      active: true,
      defaultPath: 'field-sales-pwa-preview',
      permissions: ['field-sales-pwa-preview', 'b2b-crm-directory', 'user-profile-settings']
    },
    {
      id: 'REP-KRA-02',
      name: 'Bambang S.',
      username: 'bambang',
      email: 'bambang.s@arbain.co.id',
      phone: '081234567808',
      password: '123',
      pin: '123456',
      role: 'field-sales',
      sqlRole: 'sales',
      salesRepName: 'Bambang S.',
      salesRepId: 'REP-KRA-02',
      title: 'Field Sales Representative',
      division: 'Divisi Kosmetik & Perawatan (Karanganyar Timur)',
      avatarInitials: 'BS',
      badgeColor: '#9333ea',
      active: true,
      defaultPath: 'field-sales-pwa-preview',
      permissions: ['field-sales-pwa-preview', 'b2b-crm-directory', 'user-profile-settings']
    }
  ];

  return {
    users,
    products,
    ledger,
    outlets,
    orders,
    supplierPOs,
    salesVisits,
    driverManifests,
    salesTeam,
    salesLoadings,
    visitLogs,
    baseline
  };
})();
