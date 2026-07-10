/* ────────────────────────────────────────────────────────────────────────
   i18n.js — Cross-page language switcher
   ────────────────────────────────────────────────────────────────────────
   Shared translation module used by every page (index.html, cv.html,
   projects.html, gallery.html, certificates.html, 404.html). Pairs with
   posts.js for the post overlay only when both scripts load on the same
   page.

   What it does:
   1. Reads the saved language from localStorage on boot (key:
      "blogLanguage", default "en").
   2. Mounts a language switcher into any element with id="globalLangSwitcher".
   3. Applies [data-i18n] / [data-i18n-placeholder] / [data-i18n-aria-label]
      / [data-i18n-html] on elements whose attribute is a key in
      sharedTranslations. Updates the page instantly with no network call.
   4. Dispatches a "languageChange" CustomEvent on window, detail=lang.
   Other scripts (bio.js, cv.js, projects.js, certificates.js, gallery.js,
   posts.js post overlay) listen and re-render / re-translate their
      own content. This decouples page scripts from the picker UI.
   5. Falls back to a cached Google Translate call for any text that
      didn't get pre-baked (e.g. user-supplied content). Cached in
      localStorage so the same string isn't re-fetched across reloads.
   6. Smooth loading: <main> gets a .i18n-loading class during the
      transition that gently fades it (.15s ease-in opacity dip).

   Optimisations:
   - sharedTranslations is inline (~85 keys × 3 langs ≈ 6 KB). Loads
      once inline as part of i18n.js; zero network cost per page.
   - data/*.json + gallery/index.json are pre-translated by
      scripts/translate-content.mjs at edit time, so per-page renderers
      just call i18n.localize(v) — no API round-trip per render.
   - Runtime Google Translate only used when something wasn't pre-baked.
      The result lands in localStorage so subsequent visits are instant.

   Public API (window.i18n):
     - i18n.lang                current language (string getter)
     - i18n.supportedLangs      ['en','pt','es','hi','zh']
     - i18n.setLanguage(lang)   switch language (no opts needed)
     - i18n.t(key)              shared UI string in current lang, fallback en
     - i18n.localize(v, lang?)  pick en/pt/es from a { en, pt, es } object
     - i18n.translateText(text, lang)  cached Google Translate runtime
     - i18n.plural(singularKey, pluralKey, count)  "1 image" / "N images"
     - i18n.categoryLabel(slug) translate gallery category slugs
     - i18n.format(template, vars)  "{n} / {total}" placeholder sub
     - i18n.applyStaticTranslations()
     - i18n.mountSwitcher()
     - i18n.dispatchChange()     re-emit languageChange event (for tests)
   ──────────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  var SUPPORTED = ['en', 'pt', 'es', 'hi', 'zh'];
  var LANG_KEY = 'blogLanguage';
  var CACHE_KEY = 'i18n_dynamic_cache_v1';

  /* `lang` is the runtime language. Initialised in boot() — declared here
     so localize/translateText can reference it without a temporal dead zone. */
  var lang;

  var LANG_FULL = { en: 'English', pt: 'Português', es: 'Español', hi: 'हिन्दी', zh: '中文' };

  /* ── Shared UI translations ───────────────────────────────────────────
     Keep this exhaustive — every static string on every page lives here.
     Pipe syntax: data-i18n="key1|key2" tries key1 first, falls back to
     key2 if the language pack is missing it. */
  var sharedTranslations = {
    en: {
      /* Navigation */
      navHome: 'Home',
      navGallery: 'Gallery',
      navCertificates: 'Certificates',
      navProjects: 'Projects',
      navCV: 'CV',

      /* Home (index.html) */
      homeSectionBio: 'Bio',
      homeSectionSocials: 'Socials',
      homeSectionSkills: 'Skills & Tools',
      homeMostRecentPosts: 'Most Recent Posts',
      homeViewDownloadCV: 'View / Download CV',
      homePrintFriendlyResume: 'Print-friendly résumé',

      /* CV page (cv.html) */
      cvSkillsHeader: 'Skills & Tools',
      cvSelectedPostsHeader: 'Selected posts',
      cvHomePage: 'home page',
      cvMoreOn: 'More on the',
      cvCertificatesHeader: 'Certificates',
      cvFullListAt: 'Full list at',
      cvProjectsHeader: 'Projects',
      cvInterestsHeader: 'Interests',
      cvPrintButton: 'Print / Save as PDF',
      cvPrintHint: 'opens your browser\'s print dialog',
      cvCheckItOut: 'check it out.',

      /* Projects page (projects.html) */
      projectsHeader: 'Projects',
      projectsSubtitle: 'Things built while learning.',
      projectsStatusCompleted: 'Completed',
      projectsStatusInProgress: 'In progress',
      projectsStatusPlanned: 'Planned',
      projectsOverlayType: 'Project',
      projectsOverlayYear: 'Year',
      projectsLinkRepo: 'View source',
      projectsLinkLive: 'Live demo',
      projectsEmpty: 'No projects yet.',
      projectsLoading: 'Loading projects…',
      projectsErrorLoading: 'Could not load projects. Make sure data/projects.json exists.',
      projectsCountSingular: 'project',
      projectsCountPlural: 'projects',
      projectsImagePlaceholder: 'No preview',

      /* Gallery page (gallery.html) */
      galleryHeader: 'Gallery',
      gallerySubtitle: 'Capturing light that traveled millions of years.',
      galleryDisclaimer: 'Note: Gallery images are slightly compressed for optimal load performance.',
      galleryTabAll: 'All',
      galleryCategoryStarClusters: 'Star Clusters',
      galleryCategoryGalaxies: 'Galaxies',
      galleryCategoryMoon: 'Moon',
      galleryCategoryNebula: 'Nebula',
      galleryCategorySolarSystem: 'Solar System',
      galleryCategoryWideField: 'Wide Field',
      gallerySearchPlaceholder: 'Search gallery by target, cluster name, or description…',
      galleryLoading: 'Loading gallery…',
      galleryErrorLoading: 'Error loading gallery. Make sure gallery/index.json exists.',
      galleryEmpty: 'No matching images found.',
      galleryImageSingular: 'image',
      galleryImagePlural: 'images',
      galleryOpenInLightbox: 'Open {title} in lightbox',
      galleryOpenItem: 'Open {title}',
      galleryViewFullscreen: 'View fullscreen',
      galleryDownloadW: 'Download with watermark',
      galleryDownloadItem: 'Download {title}',
      lbClose: 'Close image viewer',
      lbPrevious: 'Previous image',
      lbNext: 'Next image',
      lbDownload: 'Download',
      lbDownloading: 'Processing…',
      lbDownloadFailed: 'Download failed. If running locally, open via a local server (e.g. npx serve).',
      lbLoadError: 'Could not load image for processing.',
      lbInfoTarget: 'Target',
      lbInfoCaptured: 'Captured',
      lbInfoEquipment: 'Equipment',
      lbInfoIntegration: 'Integration',
      lbInfoNotes: 'Notes',
      lbCounterFormat: '{n} / {total}',

      /* Certificates page (certificates.html) */
      certHeader: 'Certificates',
      certSubtitle: 'Verified professional credentials and course certifications.',
      certLoading: 'Loading certificates…',
      certErrorLoading: 'Error loading certificates. Make sure certificates/index.json exists.',
      certIssued: 'Issued:',
      certExpires: 'Expires:',
      certID: 'ID:',
      certViewDocument: 'View Document',
      certVerifyCredential: 'Verify Credential',
      certEmpty: 'No certificates found.',

      /* 404 page (404.html) */
      err404: '404',
      err404Message: 'Houston, we have a problem.\nThis page has drifted out of orbit.',
      returnHome: 'Return to Earth',

      /* Site-wide banner (banner.js). Used as aria-label on the dismiss
         button — X glyph itself is language-neutral. */
      bannerDismiss: 'Dismiss banner'
    },
    pt: {
      navHome: 'Início',
      navGallery: 'Galeria',
      navCertificates: 'Certificados',
      navProjects: 'Projetos',
      navCV: 'CV',

      homeSectionBio: 'Bio',
      homeSectionSocials: 'Redes sociais',
      homeSectionSkills: 'Competências e ferramentas',
      homeMostRecentPosts: 'Publicações mais recentes',
      homeViewDownloadCV: 'Ver / Transferir CV',
      homePrintFriendlyResume: 'Currículo pronto a imprimir',

      cvSkillsHeader: 'Competências e ferramentas',
      cvSelectedPostsHeader: 'Publicações selecionadas',
      cvHomePage: 'página inicial',
      cvMoreOn: 'Mais informações na',
      cvCertificatesHeader: 'Certificados',
      cvFullListAt: 'Lista completa em',
      cvProjectsHeader: 'Projetos',
      cvInterestsHeader: 'Interesses',
      cvPrintButton: 'Imprimir / Guardar como PDF',
      cvPrintHint: 'abre a janela de impressão do seu navegador',
      cvCheckItOut: 'veja aqui.',

      projectsHeader: 'Projetos',
      projectsSubtitle: 'Coisas que construí enquanto aprendo.',
      projectsStatusCompleted: 'Concluído',
      projectsStatusInProgress: 'Em curso',
      projectsStatusPlanned: 'Planeado',
      projectsOverlayType: 'Projeto',
      projectsOverlayYear: 'Ano',
      projectsLinkRepo: 'Ver código',
      projectsLinkLive: 'Demo',
      projectsEmpty: 'Ainda sem projetos.',
      projectsLoading: 'A carregar projetos…',
      projectsErrorLoading: 'Não foi possível carregar os projetos. Confirma que data/projects.json existe.',
      projectsCountSingular: 'projeto',
      projectsCountPlural: 'projetos',
      projectsImagePlaceholder: 'Sem imagem',

      galleryHeader: 'Galeria',
      gallerySubtitle: 'Captar luz que viajou milhões de anos.',
      galleryDisclaimer: 'Nota: as imagens da galeria estão ligeiramente comprimidas para otimizar o carregamento.',
      galleryTabAll: 'Todos',
      galleryCategoryStarClusters: 'Aglomerados estelares',
      galleryCategoryGalaxies: 'Galáxias',
      galleryCategoryMoon: 'Lua',
      galleryCategoryNebula: 'Nebulosa',
      galleryCategorySolarSystem: 'Sistema Solar',
      galleryCategoryWideField: 'Campo amplo',
      gallerySearchPlaceholder: 'Pesquisar na galeria por alvo, nome do aglomerado ou descrição…',
      galleryLoading: 'A carregar a galeria…',
      galleryErrorLoading: 'Erro ao carregar a galeria. Confirma que gallery/index.json existe.',
      galleryEmpty: 'Nenhuma imagem correspondente encontrada.',
      galleryImageSingular: 'imagem',
      galleryImagePlural: 'imagens',
      galleryOpenInLightbox: 'Abrir {title} na vista ampliada',
      galleryOpenItem: 'Abrir {title}',
      galleryViewFullscreen: 'Ver em ecrã inteiro',
      galleryDownloadW: 'Transferir com marca d\'água',
      galleryDownloadItem: 'Transferir {title}',
      lbClose: 'Fechar visualizador',
      lbPrevious: 'Imagem anterior',
      lbNext: 'Próxima imagem',
      lbDownload: 'Transferir',
      lbDownloading: 'A processar…',
      lbDownloadFailed: 'A transferência falhou. Se estiver em ambiente local, abre com um servidor local (ex.: npx serve).',
      lbLoadError: 'Não foi possível carregar a imagem para processamento.',
      lbInfoTarget: 'Alvo',
      lbInfoCaptured: 'Captura',
      lbInfoEquipment: 'Equipamento',
      lbInfoIntegration: 'Integração',
      lbInfoNotes: 'Notas',
      lbCounterFormat: '{n} / {total}',

      certHeader: 'Certificados',
      certSubtitle: 'Credenciais profissionais e certificações de cursos verificadas.',
      certLoading: 'A carregar certificados…',
      certErrorLoading: 'Erro ao carregar certificados. Confirma que certificates/index.json existe.',
      certIssued: 'Emitido:',
      certExpires: 'Expira:',
      certID: 'ID:',
      certViewDocument: 'Ver documento',
      certVerifyCredential: 'Verificar credencial',
      certEmpty: 'Nenhum certificado encontrado.',

      err404: '404',
      err404Message: 'Houston, temos um problema.\nEsta página saiu da órbita.',
      returnHome: 'Voltar à Terra',

      bannerDismiss: 'Fechar banner'
    },
    es: {
      navHome: 'Inicio',
      navGallery: 'Galería',
      navCertificates: 'Certificados',
      navProjects: 'Proyectos',
      navCV: 'CV',

      homeSectionBio: 'Bio',
      homeSectionSocials: 'Redes sociales',
      homeSectionSkills: 'Habilidades y herramientas',
      homeMostRecentPosts: 'Publicaciones recientes',
      homeViewDownloadCV: 'Ver / Descargar CV',
      homePrintFriendlyResume: 'Currículum listo para imprimir',

      cvSkillsHeader: 'Habilidades y herramientas',
      cvSelectedPostsHeader: 'Publicaciones seleccionadas',
      cvHomePage: 'página principal',
      cvMoreOn: 'Más en la',
      cvCertificatesHeader: 'Certificados',
      cvFullListAt: 'Lista completa en',
      cvProjectsHeader: 'Proyectos',
      cvInterestsHeader: 'Intereses',
      cvPrintButton: 'Imprimir / Guardar como PDF',
      cvPrintHint: 'abre el diálogo de impresión del navegador',
      cvCheckItOut: 'mira aquí.',

      projectsHeader: 'Proyectos',
      projectsSubtitle: 'Cosas que construí mientras aprendo.',
      projectsStatusCompleted: 'Completado',
      projectsStatusInProgress: 'En curso',
      projectsStatusPlanned: 'Planeado',
      projectsOverlayType: 'Proyecto',
      projectsOverlayYear: 'Año',
      projectsLinkRepo: 'Ver código',
      projectsLinkLive: 'Demo',
      projectsEmpty: 'Aún no hay proyectos.',
      projectsLoading: 'Cargando proyectos…',
      projectsErrorLoading: 'No se pudieron cargar los proyectos. Verifica que data/projects.json exista.',
      projectsCountSingular: 'proyecto',
      projectsCountPlural: 'proyectos',
      projectsImagePlaceholder: 'Sin imagen',

      galleryHeader: 'Galería',
      gallerySubtitle: 'Capturando luz que viajó millones de años.',
      galleryDisclaimer: 'Nota: las imágenes de la galería están ligeramente comprimidas para optimizar la carga.',
      galleryTabAll: 'Todos',
      galleryCategoryStarClusters: 'Cúmulos estelares',
      galleryCategoryGalaxies: 'Galaxias',
      galleryCategoryMoon: 'Luna',
      galleryCategoryNebula: 'Nebulosa',
      galleryCategorySolarSystem: 'Sistema solar',
      galleryCategoryWideField: 'Campo amplio',
      gallerySearchPlaceholder: 'Buscar en la galería por objetivo, nombre del cúmulo o descripción…',
      galleryLoading: 'Cargando galería…',
      galleryErrorLoading: 'Error al cargar la galería. Verifica que gallery/index.json exista.',
      galleryEmpty: 'No se encontraron imágenes coincidentes.',
      galleryImageSingular: 'imagen',
      galleryImagePlural: 'imágenes',
      galleryOpenInLightbox: 'Abrir {title} en vista ampliada',
      galleryOpenItem: 'Abrir {title}',
      galleryViewFullscreen: 'Ver en pantalla completa',
      galleryDownloadW: 'Descargar con marca de agua',
      galleryDownloadItem: 'Descargar {title}',
      lbClose: 'Cerrar visor',
      lbPrevious: 'Imagen anterior',
      lbNext: 'Siguiente imagen',
      lbDownload: 'Descargar',
      lbDownloading: 'Procesando…',
      lbDownloadFailed: 'Descarga fallida. Si ejecutas en local, ábrelo con un servidor local (p. ej. npx serve).',
      lbLoadError: 'No se pudo cargar la imagen para procesar.',
      lbInfoTarget: 'Objetivo',
      lbInfoCaptured: 'Captura',
      lbInfoEquipment: 'Equipo',
      lbInfoIntegration: 'Integración',
      lbInfoNotes: 'Notas',
      lbCounterFormat: '{n} / {total}',

      certHeader: 'Certificados',
      certSubtitle: 'Credenciales profesionales y certificaciones verificadas.',
      certLoading: 'Cargando certificados…',
      certErrorLoading: 'Error al cargar certificados. Verifica que certificates/index.json exista.',
      certIssued: 'Emitido:',
      certExpires: 'Expira:',
      certID: 'ID:',
      certViewDocument: 'Ver documento',
      certVerifyCredential: 'Verificar credencial',
      certEmpty: 'No se encontraron certificados.',

      err404: '404',
      err404Message: 'Houston, tenemos un problema.\nEsta página se ha salido de órbita.',
      returnHome: 'Volver a la Tierra',

      bannerDismiss: 'Cerrar banner'
    },
    hi: {
      navHome: 'होम',
      navGallery: 'गैलरी',
      navCertificates: 'प्रमाणपत्र',
      navProjects: 'प्रोजेक्ट',
      navCV: 'बायोडाटा',

      homeSectionBio: 'परिचय',
      homeSectionSocials: 'सोशल मीडिया',
      homeSectionSkills: 'कौशल एवं उपकरण',
      homeMostRecentPosts: 'नवीनतम पोस्ट',
      homeViewDownloadCV: 'बायोडाटा देखें / डाउनलोड करें',
      homePrintFriendlyResume: 'प्रिंट-योग्य बायोडाटा',

      cvSkillsHeader: 'कौशल एवं उपकरण',
      cvSelectedPostsHeader: 'चुनी हुई पोस्ट',
      cvHomePage: 'मुख्य पृष्ठ',
      cvMoreOn: 'अधिक जानकारी यहाँ',
      cvCertificatesHeader: 'प्रमाणपत्र',
      cvFullListAt: 'पूरी सूची',
      cvProjectsHeader: 'प्रोजेक्ट',
      cvInterestsHeader: 'रुचियाँ',
      cvPrintButton: 'प्रिंट / PDF के रूप में सहेजें',
      cvPrintHint: 'आपके ब्राउज़र का प्रिंट डायलॉग खोलता है',
      cvCheckItOut: 'देखें।',

      nowPageTitle: 'अभी',
      nowLastUpdated: 'अंतिम अपडेट:',
      nowInspiredBy: 'से प्रेरित',
      nowHeaderLearning: 'सीख रहा हूँ',
      nowHeaderWorkingOn: 'काम कर रहा हूँ',
      nowHeaderImagingTargets: 'इमेजिंग लक्ष्य',
      nowHeaderReading: 'पढ़ रहा हूँ',
      nowHeaderOutside: 'इस साइट से बाहर',

      galleryHeader: 'गैलरी',
      gallerySubtitle: 'लाखों वर्ष यात्रा करने वाली रोशनी को कैद करना।',
      galleryDisclaimer: 'नोट: लोड प्रदर्शन के लिए गैलरी की छवियाँ थोड़ी संपीड़ित हैं।',
      galleryTabAll: 'सभी',
      galleryCategoryStarClusters: 'तारा समूह',
      galleryCategoryGalaxies: 'आकाशगंगाएँ',
      galleryCategoryMoon: 'चंद्रमा',
      galleryCategoryNebula: 'नीहारिका',
      galleryCategorySolarSystem: 'सौर मंडल',
      galleryCategoryWideField: 'वाइड फील्ड',
      gallerySearchPlaceholder: 'गैलरी में खोजें — लक्ष्य, तारा समूह या विवरण…',
      galleryLoading: 'गैलरी लोड हो रही है…',
      galleryErrorLoading: 'गैलरी लोड करने में त्रुटि। सुनिश्चित करें कि gallery/index.json मौजूद है।',
      galleryEmpty: 'कोई मिलान छवि नहीं मिली।',
      galleryImageSingular: 'छवि',
      galleryImagePlural: 'छवियाँ',
      galleryOpenInLightbox: '{title} को लाइटबॉक्स में खोलें',
      galleryOpenItem: '{title} खोलें',
      galleryViewFullscreen: 'पूर्ण स्क्रीन देखें',
      galleryDownloadW: 'वॉटरमार्क के साथ डाउनलोड करें',
      galleryDownloadItem: '{title} डाउनलोड करें',
      lbClose: 'इमेज व्यूअर बंद करें',
      lbPrevious: 'पिछली छवि',
      lbNext: 'अगली छवि',
      lbDownload: 'डाउनलोड',
      lbDownloading: 'प्रोसेसिंग…',
      lbDownloadFailed: 'डाउनलोड विफल। यदि स्थानीय रूप से चला रहे हैं, तो किसी स्थानीय सर्वर के माध्यम से खोलें (जैसे npx serve)।',
      lbLoadError: 'प्रसंस्करण के लिए छवि लोड नहीं हो सकी।',
      lbInfoTarget: 'लक्ष्य',
      lbInfoCaptured: 'कैप्चर',
      lbInfoEquipment: 'उपकरण',
      lbInfoIntegration: 'एकीकरण',
      lbInfoNotes: 'टिप्पणियाँ',
      lbCounterFormat: '{n} / {total}',

      certHeader: 'प्रमाणपत्र',
      certSubtitle: 'सत्यापित पेशेवर प्रमाणपत्र एवं कोर्स सर्टिफिकेशन।',
      certLoading: 'प्रमाणपत्र लोड हो रहे हैं…',
      certErrorLoading: 'प्रमाणपत्र लोड करने में त्रुटि। सुनिश्चित करें कि certificates/index.json मौजूद है।',
      certIssued: 'जारी:',
      certExpires: 'समाप्ति:',
      certID: 'आईडी:',
      certViewDocument: 'दस्तावेज़ देखें',
      certVerifyCredential: 'प्रमाणपत्र सत्यापित करें',
      certEmpty: 'कोई प्रमाणपत्र नहीं मिला।',

      err404: '404',
      err404Message: 'ह्यूस्टन, हमारे पास एक समस्या है।\nयह पृष्ठ कक्षा से बाहर हो गया है।',
      returnHome: 'पृथ्वी पर वापस',

      bannerDismiss: 'बैनर बंद करें'
    },
    zh: {
      navHome: '首页',
      navGallery: '画廊',
      navCertificates: '证书',
      navProjects: '项目',
      navCV: '简历',

      homeSectionBio: '简介',
      homeSectionSocials: '社交媒体',
      homeSectionSkills: '技能与工具',
      homeMostRecentPosts: '最新文章',
      homeViewDownloadCV: '查看 / 下载简历',
      homePrintFriendlyResume: '可打印的简历',

      cvSkillsHeader: '技能与工具',
      cvSelectedPostsHeader: '精选文章',
      cvHomePage: '主页',
      cvMoreOn: '更多内容请访问',
      cvCertificatesHeader: '证书',
      cvFullListAt: '完整列表',
      cvProjectsHeader: '项目',
      cvInterestsHeader: '兴趣爱好',
      cvPrintButton: '打印 / 另存为 PDF',
      cvPrintHint: '将打开浏览器的打印对话框',
      cvCheckItOut: '请查看。',

      projectsHeader: '项目',
      projectsSubtitle: '在学习过程中制作的小作品。',
      projectsStatusCompleted: '已完成',
      projectsStatusInProgress: '进行中',
      projectsStatusPlanned: '计划中',
      projectsOverlayType: '项目',
      projectsOverlayYear: '年份',
      projectsLinkRepo: '查看代码',
      projectsLinkLive: '在线演示',
      projectsEmpty: '暂无项目。',
      projectsLoading: '正在加载项目…',
      projectsErrorLoading: '加载项目失败。请确认 data/projects.json 存在。',
      projectsCountSingular: '个项目',
      projectsCountPlural: '个项目',
      projectsImagePlaceholder: '暂无图片',

      galleryHeader: '画廊',
      gallerySubtitle: '捕捉历经数百万年抵达此处的一缕光。',
      galleryDisclaimer: '注：画廊图片经过轻微压缩以优化加载速度。',
      galleryTabAll: '全部',
      galleryCategoryStarClusters: '星团',
      galleryCategoryGalaxies: '星系',
      galleryCategoryMoon: '月球',
      galleryCategoryNebula: '星云',
      galleryCategorySolarSystem: '太阳系',
      galleryCategoryWideField: '广角',
      gallerySearchPlaceholder: '按目标、星团名称或描述搜索画廊…',
      galleryLoading: '正在加载画廊…',
      galleryErrorLoading: '加载画廊出错。请确认 gallery/index.json 存在。',
      galleryEmpty: '未找到匹配的图像。',
      galleryImageSingular: '张图片',
      galleryImagePlural: '张图片',
      galleryOpenInLightbox: '在灯箱中打开 {title}',
      galleryOpenItem: '打开 {title}',
      galleryViewFullscreen: '全屏查看',
      galleryDownloadW: '下载带水印版本',
      galleryDownloadItem: '下载 {title}',
      lbClose: '关闭图片查看器',
      lbPrevious: '上一张',
      lbNext: '下一张',
      lbDownload: '下载',
      lbDownloading: '处理中…',
      lbDownloadFailed: '下载失败。如果是本地运行，请通过本地服务器打开（例如 npx serve）。',
      lbLoadError: '无法加载要处理的图片。',
      lbInfoTarget: '目标',
      lbInfoCaptured: '拍摄',
      lbInfoEquipment: '设备',
      lbInfoIntegration: '累计曝光',
      lbInfoNotes: '备注',
      lbCounterFormat: '{n} / {total}',

      certHeader: '证书',
      certSubtitle: '经过验证的专业凭证和课程认证。',
      certLoading: '正在加载证书…',
      certErrorLoading: '加载证书出错。请确认 certificates/index.json 存在。',
      certIssued: '颁发日期：',
      certExpires: '有效期至：',
      certID: '编号：',
      certViewDocument: '查看文档',
      certVerifyCredential: '验证凭证',
      certEmpty: '未找到证书。',

      err404: '404',
      err404Message: '休斯顿，我们遇到了一个问题。\n该页面已偏离轨道。',
      returnHome: '返回地球',

      bannerDismiss: '关闭横幅'
    }
  };

  /* Map gallery category slugs to i18n keys so renderTabs() can swap the
     label without hardcoding strings. Falls back to a title-cased slug if
     the slug isn't in the map (works for any new category). */
  var CATEGORY_KEYS = {
    'star-clusters': 'galleryCategoryStarClusters',
    'galaxies': 'galleryCategoryGalaxies',
    'moon': 'galleryCategoryMoon',
    'nebula': 'galleryCategoryNebula',
    'nebulae': 'galleryCategoryNebula',
    'solar-system': 'galleryCategorySolarSystem',
    'wide-field': 'galleryCategoryWideField'
  };

  function readLang() {
    var saved = null;
    try { saved = localStorage.getItem(LANG_KEY); } catch (e) {}
    return SUPPORTED.indexOf(saved) >= 0 ? saved : 'en';
  }
  function writeLang(l) {
    try { localStorage.setItem(LANG_KEY, l); } catch (e) {}
  }

  /* Pick the right string from a { en, pt, es } object. English fallback.

     Defends against recursively-nested translation objects (a bug in
     translate-content.mjs used to inflate data files by re-wrapping
     already-translated values on every run). For each shape of object
     whose keys are all in { en, pt, es }, drill down following the
     requested locale — collapsing any accidental extra wrapping. Never
     returns String(v) (which yields "[object Object]"). */
  function localize(v, langArg) {
    var l = langArg || lang;
    if (v == null) return '';
    if (typeof v === 'string') return v;
    if (typeof v === 'object' && !Array.isArray(v)) {
      /* Walk down the locale chain stopping at the first leaf string. */
      while (v && typeof v === 'object' && !Array.isArray(v)) {
        var ks = Object.keys(v);
        var allLangs = ks.length > 0 && ks.every(function (k) {
          return SUPPORTED.indexOf(k) >= 0;
        });
        if (!allLangs) break;
        if (typeof v[l] === 'string' && v[l]) return v[l];
        if (l !== 'en' && typeof v.en === 'string' && v.en) return v.en;
        /* The current locale is missing at this layer — drill down
           following 'en' (canonical) to escape corruption, OR any
           present locale if 'en' is absent. */
        if (v.en != null) { v = v.en; } else if (v.pt != null) { v = v.pt; } else { v = v.es; }
        if (typeof v === 'string') return v;
      }
    }
    return '';
  }

  /* localStorage cache for runtime Google Translate calls. Quota-safe. */
  function readCache() {
    try { return JSON.parse(localStorage.getItem(CACHE_KEY)) || {}; }
    catch (e) { return {}; }
  }
  function writeCache(obj) {
    try { localStorage.setItem(CACHE_KEY, JSON.stringify(obj)); }
    catch (e) {
      try { localStorage.removeItem(CACHE_KEY); } catch (e2) {}
    }
  }

  /* Google Translate runtime fallback. Only used when a string wasn't
     pre-baked. Returns the original text on failure so the UI never breaks. */
  async function translateText(text, langArg) {
    if (!text || typeof text !== 'string') return text;
    var tl = langArg || lang;
    if (tl === 'en') return text;
    if (SUPPORTED.indexOf(tl) < 0) return text;

    var cacheKey = text + '__' + tl;
    var cache = readCache();
    if (cache[cacheKey] != null) return cache[cacheKey];

    var targetCode = tl === 'pt' ? 'pt-PT' : (tl === 'zh' ? 'zh-CN' : tl);
    var url = 'https://translate.googleapis.com/translate_a/single'
      + '?client=gtx&sl=en&tl=' + targetCode
      + '&dt=t&q=' + encodeURIComponent(text);

    try {
      var res = await fetch(url);
      if (!res.ok) return text;
      var data = await res.json();
      /* Guard: Google Translate returns the parsed payload as
         `[[ ['translated', 'orig', null, null, 1], ... ]]` on success.
         Anything else (error envelope, throttle message, HTML 429 page
         stringified) makes data[0] not an array. Empty / null-only
         translation arrays are also rejected — returning '' is worse
         than returning the original text. */
      if (!Array.isArray(data) || !Array.isArray(data[0]) || !data[0].length) return text;
      var out = data[0].map(function (x) {
        return Array.isArray(x) && x.length ? (x[0] || '') : '';
      }).join('');
      if (!out) return text;
      cache[cacheKey] = out;
      writeCache(cache);
      return out;
    } catch (e) {
      return text;
    }
  }

  /* ── Static translation application ─────────────────────────────────── */
  function pickValue(key, langPack) {
    var raw = key.split('|');
    for (var i = 0; i < raw.length; i++) {
      var k = raw[i];
      if (langPack[k] != null) return langPack[k];
    }
    for (var j = 0; j < raw.length; j++) {
      var k2 = raw[j];
      if (sharedTranslations.en[k2] != null) return sharedTranslations.en[k2];
    }
    return key;
  }

  function applyStaticTranslations() {
    var langPack = sharedTranslations[lang] || sharedTranslations.en;
    var selector = '[data-i18n], [data-i18n-placeholder], [data-i18n-aria-label], [data-i18n-html]';
    var nodes = document.querySelectorAll(selector);
    nodes.forEach(function (el) {
      var key = el.getAttribute('data-i18n')
             || el.getAttribute('data-i18n-placeholder')
             || el.getAttribute('data-i18n-aria-label')
             || el.getAttribute('data-i18n-html');
      if (!key) return;
      var value = pickValue(key, langPack);
      if (el.hasAttribute('data-i18n-placeholder')) el.setAttribute('placeholder', value);
      else if (el.hasAttribute('data-i18n-aria-label')) el.setAttribute('aria-label', value);
      else if (el.hasAttribute('data-i18n-html')) el.innerHTML = value;
      else if (el.textContent !== value) el.textContent = value;
    });
  }

  /* Translate a gallery category slug to its localized label. Falls back to
     English title-case if the slug isn't in CATEGORY_KEYS. */
  function categoryLabel(slug, langArg) {
    var l = langArg || lang;
    var key = CATEGORY_KEYS[slug];
    var dict = sharedTranslations[l] || sharedTranslations.en;
    if (key && dict[key]) return dict[key];
    if (key && sharedTranslations.en[key]) return sharedTranslations.en[key];
    return (slug || '').split('-').map(function (p) {
      return p.charAt(0).toUpperCase() + p.slice(1);
    }).join(' ');
  }

  /* Pluralize "1 image / N images" — returns "count word". PT uses plural
     always (imagens is both the singular and plural in practice; we keep
     a singular form too for clarity). */
  function plural(singularKey, pluralKey, count) {
    var dict = sharedTranslations[lang] || sharedTranslations.en;
    var word;
    if (lang === 'pt') {
      word = (count === 1) ? (dict[singularKey] || singularKey) : (dict[pluralKey] || pluralKey);
    } else {
      word = (count === 1) ? (dict[singularKey] || singularKey) : (dict[pluralKey] || pluralKey);
    }
    return count + ' ' + word;
  }

  /* Format strings with {placeholder} substitution. */
  function format(template, vars) {
    if (!template) return '';
    return String(template).replace(/\{(\w+)\}/g, function (_, k) {
      return vars && vars[k] != null ? vars[k] : '{' + k + '}';
    });
  }

  /* URL safety filter used by per-page renderers whose URLs come from
     admin-editable JSON / markdown (so the page can't be turned into a
     script-injection vector).

     Pass-through:
       - "#anchor"
       - http(s):// and mailto: schemes (also tel:)

     Site-relative paths without a leading "/" are accepted, prefixed with
     "/" so they resolve from the site root, and run through encodeURI()
     so spaces and other unsafe chars in directory/file names are escaped
     (e.g. "gallery/star clusters/foo.webp" → "/gallery/star%20clusters/foo.webp").

     Any URL whose scheme isn't on the allow-list falls through to '#'.
     This rejects javascript:, data:, vbscript:, file:, ftp:, and any
     other scheme browsers may interpret as script content. */
  function safeUrl(u) {
    if (u == null) return '#';
    var s = String(u).trim();
    if (!s) return '#';
    if (/^#/.test(s)) return s;
    if (/^(https?|mailto|tel):/i.test(s)) return s;
    /* RFC 3986 scheme = ALPHA *( ALPHA / DIGIT / "+" / "-" / "." ) ":".
       A scheme is only safe when it's on the allow-list above, so any
       other leading scheme is an injection attempt. */
    if (/^[a-z][a-z0-9+.\-]*:/i.test(s)) return '#';
    /* No scheme + no leading "/" → treat as site-relative. */
    return '/' + encodeURI(s).replace(/^\/+/, '');
  }

  /* ── Switcher markup ────────────────────────────────────────────────── */
  function menuHTML(l) {
    var langName = LANG_FULL[l] || l.toUpperCase();
    return ''
      + '<div class="language-switcher-dropdown i18n-global">'
      +   '<button class="lang-menu-toggle" type="button" aria-haspopup="menu" aria-expanded="false" aria-label="Change language">'
      +     '<span class="lang-current-short">' + l.toUpperCase() + '</span>'
      +     '<span class="lang-current-full">' + langName + '</span>'
      +     '<span class="lang-caret">▾</span>'
      +   '</button>'
      +   '<div class="lang-menu" role="menu">'
      +     '<button class="lang-menu-option ' + (l === 'en' ? 'active' : '') + '" data-lang="en" type="button" role="menuitem">English</button>'
      +     '<button class="lang-menu-option ' + (l === 'pt' ? 'active' : '') + '" data-lang="pt" type="button" role="menuitem">Português</button>'
      +     '<button class="lang-menu-option ' + (l === 'es' ? 'active' : '') + '" data-lang="es" type="button" role="menuitem">Español</button>'
      +     '<button class="lang-menu-option ' + (l === 'hi' ? 'active' : '') + '" data-lang="hi" type="button" role="menuitem">हिन्दी</button>'
      +     '<button class="lang-menu-option ' + (l === 'zh' ? 'active' : '') + '" data-lang="zh" type="button" role="menuitem">中文</button>'
      +   '</div>'
      + '</div>';
  }

  function syncSwitcherActive(root) {
    var opts = root.querySelectorAll('.lang-menu-option');
    /* forEach gives each handler a fresh closure — the `opt` reference
       points to the actual clicked element, not opts[i] out-of-bounds. */
    opts.forEach(function (opt) {
      var optLang = opt.getAttribute('data-lang');
      opt.classList.toggle('active', optLang === lang);
    });
    var toggles = root.querySelectorAll('.lang-menu-toggle');
    toggles.forEach(function (toggle) {
      toggle.querySelector('.lang-current-short').textContent = lang.toUpperCase();
      toggle.querySelector('.lang-current-full').textContent = LANG_FULL[lang] || lang;
    });
  }

  function bindSwitcherEvents(slot) {
    var dropdown = slot.querySelector('.language-switcher-dropdown');
    var toggle = dropdown.querySelector('.lang-menu-toggle');
    var opts = dropdown.querySelectorAll('.lang-menu-option');

    toggle.addEventListener('click', function (e) {
      e.stopPropagation();
      var isOpen = dropdown.classList.toggle('open');
      toggle.setAttribute('aria-expanded', String(isOpen));
    });

    opts.forEach(function (opt) {
      opt.addEventListener('click', function (e) {
        e.stopPropagation();
        dropdown.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        var target = opt.getAttribute('data-lang');
        if (target && target !== lang) i18n.setLanguage(target);
      });
    });
  }

  function mountSwitcher() {
    var slots = document.querySelectorAll('#globalLangSwitcher');
    slots.forEach(function (slot) {
      if (slot.querySelector('.language-switcher-dropdown')) {
        syncSwitcherActive(slot);
        return;
      }
      slot.innerHTML = menuHTML(lang);
      bindSwitcherEvents(slot);
    });
  }

  function bindGlobalDismiss() {
    if (window.__i18nDismissBound) return;
    window.__i18nDismissBound = true;
    document.addEventListener('click', function () {
      var opens = document.querySelectorAll('.language-switcher-dropdown.open');
      opens.forEach(function (open) {
        open.classList.remove('open');
        var b = open.querySelector('.lang-menu-toggle');
        if (b) b.setAttribute('aria-expanded', 'false');
      });
    });
  }

  /* Smooth fade transition on language change. The dip is held for
     ~150 ms before lifting back, which lets the user actually perceive
     the 280 ms CSS .i18n-loading transition; without this delay the dip
     starts lifting before the first paint of the lower-opacity frame,
     making the whole thing feel like a single step.

     Rapid language clicks could previously leave a stale pending
     endLoadingFade timeout firing in the middle of a newer transition.
     Track the timer in module scope and clear it before each new fade. */
  var i18nLoadingTimer = null;
  function startLoadingFade() {
    if (i18nLoadingTimer != null) {
      clearTimeout(i18nLoadingTimer);
      i18nLoadingTimer = null;
    }
    var main = document.querySelector('main') || document.body;
    main.classList.add('i18n-loading');
    document.documentElement.classList.add('i18n-busy');
  }
  function endLoadingFade() {
    i18nLoadingTimer = setTimeout(function () {
      i18nLoadingTimer = null;
      var main = document.querySelector('main') || document.body;
      main.classList.remove('i18n-loading');
      document.documentElement.classList.remove('i18n-busy');
    }, 150);
  }

  function setLanguage(nextLang, opts) {
    if (SUPPORTED.indexOf(nextLang) < 0) return;
    if (nextLang === lang) return;
    lang = nextLang;
    writeLang(nextLang);

    var skipFade = opts && opts.silent;
    if (!skipFade) startLoadingFade();

    applyStaticTranslations();
    mountSwitcher();

    var evt = new CustomEvent('languageChange', { detail: { lang: lang, prev: (opts && opts.prev) || null } });
    window.dispatchEvent(evt);

    Promise.resolve().then(function () {
      if (!skipFade) endLoadingFade();
    });
  }

  function dispatchChange() {
    var evt = new CustomEvent('languageChange', { detail: { lang: lang, boot: true } });
    window.dispatchEvent(evt);
  }

  /* ── Boot ───────────────────────────────────────────────────────────── */
  /* ── Body unmask scheduling ───────────────────────────────────────────────────────────────
     Posts.js sets window.__expectsContentRenderSignal=true near its top
     and dispatches 'firstContentRendered' once the first renderPosts
     call resolves. We keep body.i18n-pending until that signal fires
     (or a 700 ms cap, whichever first) so the unmask aligns with the
     moment real translated posts are on screen. Without this, users
     with a non-English saved language see a hidden body → English
     skeleton → real posts ripple on cold load (the body's 240ms
     opacity fade lands while posts.js is still loading, and the
     skeleton gets wiped instantly when real posts arrive). */
  function unmaskBody() {
    if (window.__i18nPendingTimer) {
      clearTimeout(window.__i18nPendingTimer);
      window.__i18nPendingTimer = null;
    }
    if (document.body && document.body.classList.contains('i18n-pending')) {
      document.body.classList.remove('i18n-pending');
    }
  }
  function scheduleUnmask() {
    if (window.__expectsContentRenderSignal) {
      var cap = setTimeout(unmaskBody, 1500);
      window.addEventListener('firstContentRendered', function () {
        clearTimeout(cap);
        unmaskBody();
      }, { once: true });
    } else {
      unmaskBody();
    }
  }

  function boot() {
    lang = readLang();
    /* Re-assert <html lang> in case the inline pre-paint script didn't
       run (older cached HTML). Without this, a user with savedLang=pt
       could see <html lang="en"> until the first re-paint. */
    bindGlobalDismiss();
    mountSwitcher();
    applyStaticTranslations();
    dispatchChange();
    /* Cancel the 1.5s safety-net timer the inline pre-paint script
       parked on window.__i18nPendingTimer — we won the race so we
       don't need it. Then release the body-hide gate. The visibility
       flip happens via CSS transition (in style.css). */
    scheduleUnmask();
    window.dispatchEvent(new CustomEvent('i18nReady', { detail: { lang: lang } }));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  /* ── Public API ─────────────────────────────────────────────────────── */
  window.i18n = {
    get lang() { return lang; },
    supportedLangs: SUPPORTED,
    setLanguage: setLanguage,
    t: function (key) {
      var dict = sharedTranslations[lang] || sharedTranslations.en;
      if (dict[key] != null) return dict[key];
      if (sharedTranslations.en[key] != null) return sharedTranslations.en[key];
      return key;
    },
    localize: localize,
    translateText: translateText,
    plural: plural,
    categoryLabel: categoryLabel,
    format: format,
    safeUrl: safeUrl,
    applyStaticTranslations: applyStaticTranslations,
    mountSwitcher: mountSwitcher,
    dispatchChange: dispatchChange
  };
})();
