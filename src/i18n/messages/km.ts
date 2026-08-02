import type { Dictionary } from "./en";

/**
 * Khmer message catalogue.
 *
 * Typed as `Dictionary`, so the compiler rejects a missing or misspelled key —
 * v1's failure mode was a Khmer label silently rendering as English because a
 * `data-km` attribute was absent.
 *
 * Translation notes:
 *  - Khmer strings run roughly 20–40% longer than their English equivalents.
 *    Labels here are kept deliberately short and the layout is tested at 320px
 *    to avoid the clipped navigation the audit found in v1.
 *  - Khmer has no capitalisation, so English sentence-case conventions are not
 *    mirrored; the natural Khmer phrasing is used instead.
 */
export const km: Dictionary = {
  meta: {
    siteName: "រុន រស្មី",
    localeName: "ខ្មែរ",
  },

  a11y: {
    skipToContent: "រំលងទៅមាតិកាដើម",
    mainNavigation: "ផ្ទាំងរុករកមេ",
    breadcrumb: "ផ្លូវរុករក",
    openMenu: "បើកម៉ឺនុយរុករក",
    closeMenu: "បិទម៉ឺនុយរុករក",
    toggleTheme: "ប្តូររចនាបទពណ៌",
    themeLight: "ប្តូរទៅរចនាបទភ្លឺ",
    themeDark: "ប្តូរទៅរចនាបទងងឹត",
    switchLanguage: "ប្តូរភាសា",
    currentPage: "ទំព័របច្ចុប្បន្ន",
    opensInNewTab: "បើកក្នុងផ្ទាំងថ្មី",
    externalLink: "តំណភ្ជាប់ខាងក្រៅ",
    loading: "កំពុងផ្ទុក",
    required: "ត្រូវបំពេញ",
    optional: "ជាជម្រើស",
    closeDialog: "បិទប្រអប់",
    previous: "មុន",
    next: "បន្ទាប់",
    pagination: "ការបែងចែកទំព័រ",
    sortBy: "តម្រៀបតាម",
    filters: "តម្រង",
    clearFilters: "សម្អាតតម្រងទាំងអស់",
    resultsUpdated: "លទ្ធផលបានធ្វើបច្ចុប្បន្នភាព",
    fileTypeAndSize: "{type}, {size}",
  },

  brand: {
    homeLabel: "រុន រស្មី — ទំព័រដើម",
    role: "អ្នកអប់រំ និងអ្នកបង្កើតផលិតផល",
  },

  nav: {
    home: "ទំព័រដើម",
    projects: "គម្រោង",
    certificates: "វិញ្ញាបនបត្រ",
    experience: "បទពិសោធន៍",
    journey: "ដំណើររបស់ខ្ញុំ",
    publications: "ស្នាដៃនិពន្ធ",
    education: "ការអប់រំ",
    about: "អំពីខ្ញុំ",
    resume: "ប្រវត្តិរូប",
    contact: "ទំនាក់ទំនង",
    downloadResume: "ទាញយកប្រវត្តិរូប",
    groups: {
      work: "ស្នាដៃ",
      background: "ប្រវត្តិ",
    },
  },

  home: {
    hero: {
      eyebrow: "អ្នកអប់រំ · គណិតវិទ្យា · វិស្វកម្មកម្មវិធី",
      greeting: "សួស្តី ខ្ញុំឈ្មោះ",
      roleLine1: "អ្នកអប់រំដោយគោលបំណង",
      roleLine2: "អ្នកបង្កើតផលិតផលដោយការអនុវត្ត",
      intro:
        "ខ្ញុំរចនា និងបង្កើតផលិតផលឌីជីថលជាក់ស្តែង សម្រាប់ការអប់រំ ការបង្រៀន និងការទទួលបានធនធានសិក្សា។",
      buildsLabel: "ខ្ញុំបង្កើត",
      builds: {
        tools: "ឧបករណ៍សម្រាប់គ្រូ",
        platforms: "វេទិកាសិក្សា",
        systems: "ប្រព័ន្ធរៀនឌីជីថល",
        libraries: "លទ្ធភាពទទួលបានឯកសារសិក្សា",
      },
      exploreWork: "ស្វែងយល់ស្នាដៃរបស់ខ្ញុំ",
      viewProjects: "មើលគម្រោងរបស់ខ្ញុំ",
      downloadResume: "ទាញយកប្រវត្តិរូប",
      contactMe: "ទំនាក់ទំនងខ្ញុំ",
      availableForWork: "បើកចំហសម្រាប់ឱកាស",
      notAvailable: "បច្ចុប្បន្នមិនទទួលការងារថ្មីទេ",
      basedIn: "មានទីតាំងនៅ {location}",
      speaks: "ភាសា",
      portraitAlt: "រូបថតរបស់ រុន រស្មី",
      scrollCue: "រំកិលចុះក្រោមដើម្បីមើលបន្ត",
      roles: {
        educator: "អ្នកអប់រំ",
        builder: "អ្នកបង្កើតផលិតផល",
      },
    },

    caseStudy: {
      eyebrow: "ករណីសិក្សាពិសេស",
      problem: "បញ្ហា",
      approach: "វិធីសាស្ត្រ",
      outcome: "អ្វីដែលវាធ្វើសព្វថ្ងៃ",
      role: "តួនាទី",
      organisation: "ស្ថាប័ន",
      year: "ឆ្នាំ",
      category: "ប្រភេទ",
      whatItDoes: "មុខងារសំខាន់",
      builtWith: "បង្កើតដោយ",
      readCaseStudy: "អានករណីសិក្សាពេញលេញ",
      visitProject: "ចូលមើល {name}",
    },

    ecosystem: {
      eyebrow: "របៀបដែលវេទិកាទាំងបីភ្ជាប់គ្នា",
      heading: "ផលិតផលបី ប្រព័ន្ធតែមួយ",
      body: "វេទិកានីមួយៗដោះស្រាយបញ្ហារបស់ខ្លួន ហើយនីមួយៗកាន់តែមានប្រយោជន៍ព្រោះមានពីរផ្សេងទៀត។ រួមគ្នាពួកវាគ្របដណ្តប់ការបង្រៀន ឯកសារសិក្សា និងហេដ្ឋារចនាសម្ព័ន្ធនៅពីក្រោមទាំងពីរ។",
      visit: "ចូលមើលគេហទំព័រ",
    },

    dualIdentity: {
      eyebrow: "ការអនុវត្តពីរ",
      heading: "ថ្នាក់រៀនកំណត់តម្រូវការ វិស្វកម្មធ្វើឱ្យវាកើតឡើង។",
      educationLabel: "ការអនុវត្តផ្នែកអប់រំ",
      educationCaption: "ការបង្រៀន គណិតវិទ្យា និងការងារសិក្សា",
      productLabel: "ការអនុវត្តផ្នែកផលិតផល",
      productCaption: "ការរចនា វិស្វកម្ម និងប្រព័ន្ធនៅពីក្រោម",
      skillCount: "សមត្ថភាព {count}",
    },

    systemMap: {
      eyebrow: "របៀបដែលការងារកើតឡើង",
      heading: "បញ្ហាក្នុងថ្នាក់រៀន តាមដានរហូតដល់ប្រព័ន្ធ",
      body: "ផលិតផលភាគច្រើនទាំងនេះចាប់ផ្តើមពីអ្វីមួយដែលមិនដំណើរការក្នុងថ្នាក់រៀន ឬបណ្ណាល័យជាក់ស្តែង។ នេះជាផ្លូវពីការកត់សម្គាល់រហូតដល់ការបង្កើតដំណោះស្រាយ។",
      stages: {
        teaching: {
          title: "ការអនុវត្តការបង្រៀន",
          body: "ការបង្រៀនឯកជន កម្មសិក្សាបង្រៀន និងការចុះសាលារៀន — កន្លែងដែលបញ្ហាត្រូវបានជួបដំបូង ក្នុងនាមជាអ្នកទទួលខុសត្រូវដោះស្រាយវានៅថ្ងៃនោះ។",
        },
        problems: {
          title: "បញ្ហា ដែលបញ្ជាក់ច្បាស់",
          body: "ដំណើរការការងាររបស់គ្រូដែលចំណាយពេលយូរ ឯកសារដែលគ្មាននរណារកឃើញ និងសម្ភារសិក្សាដែលគ្មានកន្លែងរក្សាទុកជាប្រព័ន្ធ។ កត់ត្រាទុកមុននឹងចាប់ផ្តើមរចនា។",
        },
        design: {
          title: "ការស្រាវជ្រាវ និងការរចនាផលិតផល",
          body: "សម្រាប់នរណា អ្វីដែលពួកគេធ្វើរួចហើយ និងប្រព័ន្ធតូចបំផុតដែលអាចជួយបាន។ ស្ថាបត្យកម្មព័ត៌មាន ដំណើរការការងារ និងការរចនាចំណុចប្រទាក់។",
        },
        engineering: {
          title: "វិស្វកម្ម",
          body: "ការកសាង៖ គំរូទិន្នន័យ សិទ្ធិចូលប្រើ ការផ្ទៀងផ្ទាត់ ការផ្ទុក និងការបញ្ជូន។ ពីរភាសាតាំងពីអេក្រង់ដំបូង មិនមែនបកប្រែពេលក្រោយទេ។",
        },
        access: {
          title: "សម្ភារសិក្សាដែលងាយទទួលបាន",
          body: "លទ្ធផល — វេទិកាដែលគ្រូ និងសិស្សអាចចូលប្រើបានពិតប្រាកដ និងឯកសារគណិតវិទ្យាដែលនិពន្ធដាក់ចូលក្នុងវា។",
        },
      },
    },

    about: {
      eyebrow: "អំពីខ្ញុំ",
      heading: "ការអនុវត្តពីរ គោលបំណងតែមួយ",
      body: "ខ្ញុំកំពុងបណ្តុះបណ្តាលជាគ្រូបឋមសិក្សា និងសិក្សាគណិតវិទ្យា ហើយខ្ញុំបង្កើតកម្មវិធីដែលគ្រូ និងសិស្សប្រើប្រាស់ជាក់ស្តែង។ ការបង្រៀនប្រាប់ខ្ញុំពីអ្វីដែលឧបករណ៍ត្រូវធ្វើ ឯវិស្វកម្មធ្វើឱ្យវាកើតឡើងជាក់ស្តែង។",
      factsHeading: "ព័ត៌មានសង្ខេប",
      focusHeading: "ការផ្តោតបច្ចុប្បន្ន",
      locationLabel: "មានទីតាំងនៅ",
      languagesLabel: "ភាសា",
      readMore: "អានបន្ថែមអំពីខ្ញុំ",
    },
    credibility: {
      heading: "ព័ត៌មានសង្ខេប",
      note: "រាប់ចេញពីខ្លឹមសារដែលបានផ្សព្វផ្សាយលើគេហទំព័រនេះ។",
      publishedProjects: "គម្រោងបានផ្សព្វផ្សាយ",
      certificates: "វិញ្ញាបនបត្រ",
      yearsJourney: "ចំនួនឆ្នាំនៃដំណើរនេះ",
      languages: "ភាសា",
      experiences: "តួនាទី និងកម្មសិក្សា",
    },
    featured: {
      eyebrow: "ស្នាដៃជ្រើសរើស",
      heading: "គម្រោងដែលខ្ញុំបានរចនា និងបង្កើត",
      description:
        "ប្រព័ន្ធពិតប្រាកដ ដំណើរការជាក់ស្តែង ប្រើប្រាស់ក្នុងបរិបទបណ្តុះបណ្តាលគ្រូ។ គ្រប់គម្រោងមានករណីសិក្សាពេញលេញ។",
      viewCaseStudy: "មើលករណីសិក្សា",
      visitLive: "ចូលមើលគេហទំព័រ",
      viewAll: "មើលគម្រោងទាំងអស់",
      empty: "គម្រោងលេចធ្លោនឹងបង្ហាញនៅទីនេះ បន្ទាប់ពីត្រូវបានផ្សព្វផ្សាយ។",
      emptyHeading: "ករណីសិក្សាកំពុងរៀបចំ",
      emptyBody: "សូមស្វែងយល់វេទិកាដែលកំពុងដំណើរការរបស់ខ្ញុំជាមុនសិន។",
      liveNow: "កំពុងដំណើរការ",
    },
    capabilities: {
      eyebrow: "អ្វីដែលខ្ញុំធ្វើ",
      heading: "សមត្ថភាព ជាមួយស្នាដៃដែលបញ្ជាក់វា",
      description:
        "គ្មានពិន្ទុវាយតម្លៃខ្លួនឯងទេ។ សមត្ថភាពនីមួយៗភ្ជាប់ទៅគម្រោង និងវិញ្ញាបនបត្រដែលបញ្ជាក់វា។",
      evidencedBy: "បញ្ជាក់ដោយ",
      noEvidenceYet: "មិនទាន់មានគម្រោងភ្ជាប់ទេ",
    },
    certificates: {
      eyebrow: "សញ្ញាបត្រ",
      heading: "វិញ្ញាបនបត្រ និងសមិទ្ធផលសិក្សា",
      viewCredential: "មើលសញ្ញាបត្រ",
      viewAll: "មើលវិញ្ញាបនបត្រទាំងអស់",
      empty: "វិញ្ញាបនបត្រនឹងបង្ហាញនៅទីនេះ បន្ទាប់ពីត្រូវបានពិនិត្យ និងផ្សព្វផ្សាយ។",
      emptyHeading: "សញ្ញាបត្រកំពុងពិនិត្យឯកជនភាព",
      emptyBody:
        "វិញ្ញាបនបត្រត្រូវបានផ្សព្វផ្សាយនៅទីនេះ បន្ទាប់ពីព័ត៌មានផ្ទាល់ខ្លួនត្រូវបានលុបចេញ។",
    },
    journey: {
      eyebrow: "ការអប់រំ និងដំណើរជីវិត",
      heading: "របៀបដែលខ្ញុំមកដល់ទីនេះ",
      present: "បច្ចុប្បន្ន",
      expected: "រំពឹងទុក",
      viewAll: "មើលបទពិសោធន៍ពេញលេញ",
      moreEntries: "និង {count} ទៀតនៅទំព័របទពិសោធន៍ពេញលេញ។",
    },
    moments: {
      eyebrow: "ដំណើររបស់ខ្ញុំ",
      heading: "ព្រឹត្តិការណ៍សំខាន់ៗក្នុងដំណើររបស់ខ្ញុំ",
      description:
        "ការងារចុះទីតាំង កម្មសិក្សាបង្រៀន ការផ្លាស់ប្តូរបទពិសោធន៍ និងព្រឹត្តិការណ៍នានាតាមផ្លូវ។",
      viewStory: "មើលរឿងរ៉ាវ",
      viewAll: "មើលដំណើរទាំងមូល",
    },
    publications: {
      eyebrow: "ស្នាដៃរៀបរៀង",
      heading: "ស្នាដៃនិពន្ធសំខាន់ៗ",
      description:
        "សៀវភៅគណិតវិទ្យា និងឯកសារសិក្សាដែលខ្ញុំបានរៀបរៀង និងវាយអត្ថបទដោយ LaTeX។",
      viewPublication: "មើលស្នាដៃ",
      viewAll: "មើលស្នាដៃទាំងអស់",
    },
    testimonials: {
      eyebrow: "ឯកសារយោង",
      heading: "អ្វីដែលសហការីនិយាយ",
      relationshipLabel: "ទំនាក់ទំនង",
      empty: "ឯកសារយោងនឹងបង្ហាញនៅទីនេះ បន្ទាប់ពីត្រូវបានបញ្ជាក់។",
    },
    cta: {
      heading: "តោះបង្កើតអ្វីមួយដែលមានអត្ថន័យ។",
      description:
        "តើអ្នកមានគំនិតអំពីការអប់រំ ការបង្រៀន ឬផលិតផលឌីជីថលទេ? ខ្ញុំបើកចំហសម្រាប់តួនាទីបង្រៀន ការជួយបំប៉ន និងការបង្កើតវេទិកាសិក្សា។",
      emailMe: "ផ្ញើអ៊ីមែលមកខ្ញុំ",
      openContactForm: "ផ្ញើសារ",
      telegram: "ផ្ញើសារតាមតេឡេក្រាម",
    },
  },

  projects: {
    title: "គម្រោង និងករណីសិក្សា",
    description: "វេទិកាអប់រំ និងសិក្សា ដែលខ្ញុំបានរចនា បង្កើត និងដាក់ដំណើរការ។",
    searchLabel: "ស្វែងរកគម្រោង",
    searchPlaceholder: "ស្វែងរកតាមឈ្មោះ បញ្ហា ឬបច្ចេកវិទ្យា",
    filterCategory: "ប្រភេទ",
    filterTechnology: "បច្ចេកវិទ្យា",
    filterStatus: "ស្ថានភាព",
    allCategories: "ប្រភេទទាំងអស់",
    allTechnologies: "បច្ចេកវិទ្យាទាំងអស់",
    allStatuses: "ស្ថានភាពទាំងអស់",
    featuredOnly: "តែគម្រោងលេចធ្លោ",
    resultCount: "គម្រោង {count}",
    resultCountPlural: "គម្រោង {count}",
    noResults: "គ្មានគម្រោងត្រូវនឹងតម្រងទាំងនេះទេ",
    noResultsHint: "សូមព្យាយាមដកតម្រងមួយចេញ ឬសម្អាតការស្វែងរក។",
    emptyState: "មិនទាន់មានគម្រោងបានផ្សព្វផ្សាយទេ។",
    emptyHeading: "ករណីសិក្សាកំពុងរៀបចំ",
    emptyBody:
      "វេទិកាខាងក្រោមកំពុងដំណើរការ និងប្រើប្រាស់ជារៀងរាល់ថ្ងៃ។ ករណីសិក្សាជាលាយលក្ខណ៍អក្សរកំពុងត្រូវបានបន្ថែម។",
    exploreLive: "ស្វែងយល់វេទិកាដែលកំពុងដំណើរការ",
    screenshotAlt: "រូបថតអេក្រង់ទំព័រដើមរបស់ {name}",
    showFilters: "តម្រងគម្រោង",
    hideFilters: "លាក់តម្រង",
    loadMore: "ផ្ទុកគម្រោងបន្ថែម",
    role: "តួនាទី",
    organization: "ស្ថាប័ន",
    year: "ឆ្នាំ",
    teamSize: "ចំនួនក្រុម",
    duration: "រយៈពេល",
    status: "ស្ថានភាព",
    technologies: "បច្ចេកវិទ្យាប្រើប្រាស់",
    liveSite: "គេហទំព័រពិត",
    repository: "ឃ្លាំងកូដ",
    caseStudy: "ករណីសិក្សា",
    backToProjects: "គម្រោងទាំងអស់",
    onThisPage: "នៅក្នុងទំព័រនេះ",
    notConfirmed: "មិនទាន់បានបញ្ជាក់",
    translationFallback:
      "ករណីសិក្សានេះមិនទាន់បានបកប្រែទេ ដូច្នេះវាបង្ហាញជាភាសាអង់គ្លេស។",
    projectStatus: {
      live: "ដំណើរការ",
      in_development: "កំពុងអភិវឌ្ឍ",
      maintained: "កំពុងថែទាំ",
      sunset: "បានបញ្ចប់",
      concept: "គំនិតដំបូង",
    },
    sections: {
      overview: "ទិដ្ឋភាពទូទៅ",
      problem: "បញ្ហា",
      targetUsers: "សម្រាប់អ្នកណា",
      goals: "គោលដៅ",
      myRole: "តួនាទីរបស់ខ្ញុំ",
      responsibilities: "ភារកិច្ច",
      constraints: "ឧបសគ្គ",
      research: "ការស្រាវជ្រាវ និងស្វែងយល់",
      uxDecisions: "ការសម្រេចចិត្តលើ UX",
      architecture: "រចនាសម្ព័ន្ធប្រព័ន្ធ",
      databaseDecisions: "ការសម្រេចចិត្តលើមូលដ្ឋានទិន្នន័យ",
      keyFeatures: "មុខងារសំខាន់",
      security: "សុវត្ថិភាព",
      accessibility: "លទ្ធភាពប្រើប្រាស់",
      seo: "SEO",
      performance: "ដំណើរការ",
      challenges: "បញ្ហាប្រឈម",
      solution: "ដំណោះស្រាយ",
      results: "លទ្ធផល",
      lessons: "អ្វីដែលខ្ញុំបានរៀន",
      nextSteps: "ការកែលម្អបន្ទាប់",
      gallery: "រូបភាពអេក្រង់",
      metrics: "លទ្ធផលដែលបានវាស់",
    },
    metrics: {
      heading: "លទ្ធផលដែលបានវាស់",
      note: "បង្ហាញតែលេខដែលមានប្រភពកត់ត្រាទុក។",
      measuredOn: "វាស់នៅ {date}",
      none: "មិនទាន់មានលេខដែលបានផ្ទៀងផ្ទាត់សម្រាប់គម្រោងនេះទេ។",
    },
    gallery: {
      desktop: "កុំព្យូទ័រ",
      mobile: "ទូរស័ព្ទ",
      diagram: "ដ្យាក្រាម",
      before: "មុន",
      after: "ក្រោយ",
    },
  },

  certificates: {
    title: "វិញ្ញាបនបត្រ និងសមិទ្ធផលសិក្សា",
    description: "សញ្ញាបត្រដែលបានផ្ទៀងផ្ទាត់ រង្វាន់សិក្សា និងវិញ្ញាបនបត្របណ្តុះបណ្តាលគ្រូ។",
    searchLabel: "ស្វែងរកវិញ្ញាបនបត្រ",
    searchPlaceholder: "ស្វែងរកតាមចំណងជើង ឬស្ថាប័នចេញឱ្យ",
    filterCategory: "ប្រភេទ",
    filterIssuer: "ស្ថាប័នចេញឱ្យ",
    filterYear: "ឆ្នាំ",
    allCategories: "ប្រភេទទាំងអស់",
    allIssuers: "ស្ថាប័នទាំងអស់",
    allYears: "ឆ្នាំទាំងអស់",
    resultCount: "វិញ្ញាបនបត្រ {count}",
    resultCountPlural: "វិញ្ញាបនបត្រ {count}",
    noResults: "គ្មានវិញ្ញាបនបត្រត្រូវនឹងតម្រងទាំងនេះទេ",
    emptyState: "វិញ្ញាបនបត្រនឹងបង្ហាញនៅទីនេះ បន្ទាប់ពីត្រូវបានផ្សព្វផ្សាយ។",
    emptyHeading: "សញ្ញាបត្រកំពុងពិនិត្យឯកជនភាព",
    emptyBody:
      "វិញ្ញាបនបត្រ និងសញ្ញាបត្រសិក្សាត្រូវបានបន្ថែមនៅទីនេះ បន្ទាប់ពីព័ត៌មានផ្ទាល់ខ្លួនត្រូវបានលុបចេញ។",
    privacyShort: "ការមើលជាសាធារណៈត្រូវបានលុបព័ត៌មានផ្ទាល់ខ្លួនរសើបចេញ។",
    showFilters: "តម្រងវិញ្ញាបនបត្រ",
    featuredCredential: "សញ្ញាបត្រលេចធ្លោ",
    issuer: "ចេញឱ្យដោយ",
    issuedOn: "ថ្ងៃចេញឱ្យ",
    expiresOn: "ថ្ងៃផុតកំណត់",
    noExpiry: "គ្មានថ្ងៃផុតកំណត់",
    credentialId: "លេខសម្គាល់សញ្ញាបត្រ",
    category: "ប្រភេទ",
    skills: "ជំនាញដែលបានបញ្ជាក់",
    verify: "ផ្ទៀងផ្ទាត់សញ្ញាបត្រ",
    verifyUnavailable: "គ្មានការផ្ទៀងផ្ទាត់តាមអ៊ីនធឺណិតទេ",
    download: "ទាញយកវិញ្ញាបនបត្រ",
    downloadUnavailable: "ឯកសារនេះមិនអាចទាញយកបានទេ",
    relatedProjects: "គម្រោងពាក់ព័ន្ធ",
    relatedEducation: "ការអប់រំពាក់ព័ន្ធ",
    backToCertificates: "វិញ្ញាបនបត្រទាំងអស់",
    previewAlt: "ការបង្ហាញរបស់ {title}",
    previewNote:
      "រូបភាពបង្ហាញគឺជាច្បាប់ចម្លងដែលបានលាក់ព័ត៌មាន។ ព័ត៌មានសម្គាល់ខ្លួនត្រូវបានដកចេញមុនការផ្សព្វផ្សាយ។",
    documentSummary: "អ្វីដែលឯកសារនេះបង្ហាញ",
    status: {
      active: "មានសុពលភាព",
      expired: "ផុតកំណត់",
      revoked: "បានដកហូត",
      unverified: "រង់ចាំការផ្ទៀងផ្ទាត់",
    },
  },

  resume: {
    title: "ប្រវត្តិរូបសង្ខេប",
    description: "អានប្រវត្តិរូបបច្ចុប្បន្នតាមអ៊ីនធឺណិត ឬទាញយកជា PDF។",
    download: "ទាញយក PDF",
    print: "បោះពុម្ព",
    lastUpdated: "ធ្វើបច្ចុប្បន្នភាពចុងក្រោយ {date}",
    currentVersion: "កំណែបច្ចុប្បន្ន៖ {label}",
    noResume: "មិនទាន់មានប្រវត្តិរូបបានផ្សព្វផ្សាយទេ។",
    noResumeForLocale:
      "មិនទាន់មានប្រវត្តិរូបជាភាសា{language}ទេ។ កំពុងបង្ហាញកំណែ{fallback}។",
    viewOtherLanguage: "មើលកំណែជាភាសា{language}",
    sections: {
      profile: "ប្រវត្តិរូបសង្ខេប",
      education: "ការអប់រំ",
      experience: "បទពិសោធន៍",
      projects: "គម្រោង",
      certificates: "វិញ្ញាបនបត្រ",
      skills: "ជំនាញ",
      languages: "ភាសា",
      contact: "ទំនាក់ទំនង",
    },
  },

  about: {
    title: "អំពីខ្ញុំ",
    positioningHeading: "អ្នកអប់រំ និស្សិតគណិតវិទ្យា និងអ្នកបង្កើតផលិតផលឌីជីថល",
    twoIdentities: "ពាក់កណ្តាលពីរនៃការអនុវត្តតែមួយ",
    educationIdentity: "ការអប់រំ",
    technologyIdentity: "បច្ចេកវិទ្យា និងផលិតផល",
    languagesHeading: "ភាសា",
    locationHeading: "ទីតាំង",
    capabilitiesHeading: "សមត្ថភាព",
    referencesHeading: "ឯកសារយោង",
  },

  experience: {
    title: "បទពិសោធន៍",
    description:
      "ការអនុវត្តបង្រៀន កម្មសិក្សាបង្រៀន ការបង្រៀនគណិតវិទ្យា និងផលិតផលអប់រំឌីជីថលដែលកើតចេញពីវា។",
    current: "បច្ចុប្បន្ន",
    emptyState: "បទពិសោធន៍នឹងបង្ហាញនៅទីនេះ បន្ទាប់ពីត្រូវបានផ្សព្វផ្សាយ។",

    hero: {
      eyebrow: "បទពិសោធន៍ · ការអប់រំ × បច្ចេកវិទ្យា",
      headline: "ពីការអនុវត្តក្នុងថ្នាក់រៀន ទៅជាប្រព័ន្ធអប់រំឌីជីថល។",
      lede: "ការបង្រៀន គណិតវិទ្យា និងវិស្វកម្មផលិតផល គឺជាខ្សែការងារតែមួយសម្រាប់ខ្ញុំ។ ពេលវេលានៅក្នុងថ្នាក់រៀនពិតប្រាកដ គឺជាកន្លែងដែលតម្រូវការកើតឡើង ហើយការបង្កើតប្រព័ន្ធ គឺជារបៀបដែលតម្រូវការនោះត្រូវបានឆ្លើយតប។",
      explore: "មើលបទពិសោធន៍",
      projects: "មើលគម្រោង",
      pathLabel: "របៀបដែលការអនុវត្តទាំងពីរភ្ជាប់គ្នា ជំហានម្តងមួយៗ",
      path: {
        teaching: "ការអនុវត្តបង្រៀន",
        observation: "ការសង្កេតថ្នាក់រៀន",
        research: "ការស្រាវជ្រាវផលិតផល",
        engineering: "UX និងវិស្វកម្ម",
        systems: "ប្រព័ន្ធអប់រំ",
      },
    },

    summary: {
      label: "សង្ខេបបទពិសោធន៍",
      educationSpan: "ការអនុវត្តអប់រំ",
      productSpan: "វិស្វកម្មផលិតផល",
      entries: "បទពិសោធន៍ដែលបានជ្រើសរើស",
      products: "ផលិតផលដែលបានបង្កើត",
    },

    tracks: {
      eyebrow: "ការអនុវត្តពីរផ្នែក",
      heading: "ផ្លូវពីរ គោលបំណងតែមួយ",
      education: {
        label: "ការអនុវត្តអប់រំ",
        statement:
          "សិក្សាពីរបៀបដែលសិស្សរៀន របៀបដែលគ្រូធ្វើការ និងរបៀបដែលថ្នាក់រៀនដំណើរការជាក់ស្តែង។",
      },
      product: {
        label: "វិស្វកម្មផលិតផល",
        statement:
          "បម្លែងបញ្ហាផ្នែកអប់រំ និងធនធានសិក្សា ទៅជាប្រព័ន្ធឌីជីថលដែលអាចទុកចិត្តបាន។",
      },
      connection:
        "ខ្ញុំរចនាផលិតផលអប់រំចេញពីបទពិសោធន៍ក្នុងថ្នាក់រៀន មិនមែនចេញពីបច្ចេកវិទ្យាតែម្យ៉ាងឡើយ។",
      evidence: "បញ្ជាក់ដោយ",
    },

    filters: {
      label: "ត្រងបទពិសោធន៍",
      all: "ទាំងអស់",
      education: "ការអប់រំ",
      practicum: "កម្មសិក្សា",
      product: "ផលិតផល",
      mathematics: "គណិតវិទ្យា",
      /* ភាសាខ្មែរគ្មានទម្រង់ពហុវចនៈ ដូច្នេះទម្រង់ទាំងពីរដូចគ្នា។ */
      result: "បង្ហាញបទពិសោធន៍ {count}",
      resultPlural: "បង្ហាញបទពិសោធន៍ {count}",
    },

    timeline: {
      eyebrow: "លំដាប់កាលបរិច្ឆេទ",
      heading: "ការងារ តាមលំដាប់ដែលបានកើតឡើង",
      description:
        "ការអនុវត្តអប់រំនៅម្ខាង វិស្វកម្មផលិតផលនៅម្ខាងទៀត តាមលំដាប់ឆ្នាំដែលបទពិសោធន៍នីមួយៗបញ្ជាក់។",
      listLabel: "លំដាប់បទពិសោធន៍ ចាប់ពីមុនគេ",
      undated: "កាលបរិច្ឆេទត្រូវបញ្ជាក់",
    },

    status: {
      currentRole: "តួនាទីបច្ចុប្បន្ន",
      currentPracticum: "កម្មសិក្សាបច្ចុប្បន្ន",
    },

    card: {
      contributions: "ការចូលរួមសំខាន់ៗ",
      skills: "ជំនាញ និងផ្នែកផ្តោតសំខាន់",
      viewFull: "មើលបទពិសោធន៍ពេញលេញ",
      about: "អំពីតួនាទីនេះ",
      allContributions: "អ្វីដែលខ្ញុំបានធ្វើ",
      relatedProjects: "ផលិតផលដែលបានបង្កើតក្នុងតួនាទីនេះ",
      viewProject: "មើលគម្រោង",
      visitLive: "បើកគេហទំព័រផ្ទាល់",
      organisation: "គេហទំព័រស្ថាប័ន",
    },

    kind: {
      teaching: "ការបង្រៀន",
      practicum: "កម្មសិក្សា",
      development: "ការអភិវឌ្ឍ",
      volunteer: "ស្ម័គ្រចិត្ត",
      leadership: "ភាពជាអ្នកដឹកនាំ",
      tutoring: "ការជួយបំប៉ន",
      other: "ផ្សេងទៀត",
    },
    achievements: "ចំណុចលេចធ្លោ",
    photos: {
      view: "មើលរូបភាព",
      viewAll: "មើលរូបភាពទាំងអស់",
      viewCount: "មើលរូបភាព {count}",
      viewCountPlural: "មើលរូបភាព {count}",
      galleryTitle: "កម្រងរូបភាព — {entry}",
      previous: "រូបភាពមុន",
      next: "រូបភាពបន្ទាប់",
      close: "បិទកម្រងរូបភាព",
      position: "រូបភាពទី {current} ក្នុងចំណោម {total}",
      openPhoto: "បើករូបភាព៖ {caption}",
    },

    tagAliases: {
      teachingPracticum: "កម្មសិក្សាបង្រៀន",
      programme12Plus4: "កម្មវិធី ១២+៤",
      uxUiDesign: "ការរចនា UX/UI",
      privateTutoring: "ការបង្រៀនឯកជន",
    },

    evidence: {
      eyebrow: "ភស្តុតាង",
      heading: "ជំនាញ និងការងារដែលបញ្ជាក់ពីវា",
      description:
        "គ្មានពិន្ទុវាយតម្លៃដោយខ្លួនឯងទេ។ ប្រធានបទនីមួយៗរាយតួនាទី ផលិតផល និងស្នាដៃបោះពុម្ពដែលបញ្ជាក់ពីវា។",
      themeListLabel: "ប្រធានបទ",
      evidenceFor: "ភស្តុតាងសម្រាប់ {theme}",
      itemCount: "{count} ធាតុ",
      itemCountPlural: "{count} ធាតុ",
      kinds: {
        experience: "បទពិសោធន៍",
        project: "គម្រោង",
        publication: "ស្នាដៃបោះពុម្ព",
      },
    },

    themes: {
      mathematics: {
        label: "គណិតវិទ្យា",
        description:
          "ការបង្រៀន ការបំប៉ន និងការនិពន្ធគណិតវិទ្យាសម្រាប់សិស្សបឋមសិក្សា និងមធ្យមសិក្សាទុតិយភូមិ។",
      },
      lessonPlanning: {
        label: "ការរៀបចំផែនការមេរៀន",
        description:
          "ការរៀបចំមេរៀនមានរចនាសម្ព័ន្ធ សម្ភារៈបង្រៀន និងលំដាប់នៃការសិក្សា។",
      },
      classroomPractice: {
        label: "ការអនុវត្តក្នុងថ្នាក់រៀន",
        description:
          "ការសង្កេត ការគ្រប់គ្រងថ្នាក់រៀន និងការវាយតម្លៃសិស្សនៅសាលាបឋមសិក្សា។",
      },
      learnerSupport: {
        label: "ការគាំទ្រសិស្ស",
        description:
          "ការគាំទ្រសិស្សម្នាក់ៗ និងជាក្រុមតូច ទាំងក្នុងថ្នាក់ និងក្នុងការបំប៉ន។",
      },
      productDesign: {
        label: "ការរចនាផលិតផល និង UX",
        description:
          "ការស្រាវជ្រាវ ស្ថាបត្យកម្មព័ត៌មាន និងការរចនាចំណុចប្រទាក់សម្រាប់ឧបករណ៍អប់រំ។",
      },
      engineering: {
        label: "វិស្វកម្ម Full-Stack",
        description:
          "Next.js, Supabase និង PostgreSQL ជាមួយនឹង Accessibility និង Technical SEO ពេញលេញ។",
      },
      academicSystems: {
        label: "ប្រព័ន្ធសិក្សា",
        description:
          "បណ្ណាល័យឌីជីថល ឃ្លាំងស្នាដៃសិក្សា និងហេដ្ឋារចនាសម្ព័ន្ធឯកសារនៅពីក្រោយវា។",
      },
    },

    cta: {
      eyebrow: "បន្តទៅមុខ",
      heading: "បទពិសោធន៍ក្នុងថ្នាក់រៀនកំណត់របៀបដែលខ្ញុំរចនាផលិតផលឌីជីថល។",
      body: "ស្វែងយល់ពីវេទិកាដែលខ្ញុំបានបង្កើតសម្រាប់គ្រូបង្រៀន សិស្សនិស្សិត និងស្ថាប័នសិក្សា។",
      projects: "មើលគម្រោងដែលបានជ្រើសរើស",
      contact: "ទំនាក់ទំនងខ្ញុំ",
    },
  },

  education: {
    title: "ការអប់រំ",
    description:
      "បរិញ្ញាបត្រពីរស្របគ្នា — គរុកោសល្យបឋមសិក្សា និងគណិតវិទ្យាអនុវត្ត — រួមជាមួយសញ្ញាបត្រសាលាដែលនាំមកដល់ចំណុចនេះ។",
    emptyState: "ការអប់រំនឹងបង្ហាញនៅទីនេះ បន្ទាប់ពីត្រូវបានផ្សព្វផ្សាយ។",
    qualification: "សញ្ញាបត្រ",
    fieldOfStudy: "ជំនាញសិក្សា",
    schedule: "កាលវិភាគ",
    grade: "លទ្ធផល",
    gradeScale: "មាត្រដ្ឋាន",
    current: "កំពុងសិក្សា",

    hero: {
      eyebrow: "ការអប់រំ · ការបង្រៀន × គណិតវិទ្យា",
      headline: "ផ្លូវសិក្សាពីរ ឆ្ពោះទៅគោលបំណងតែមួយ៖ ការអប់រំកាន់តែល្អ។",
      lede: "ខ្ញុំសិក្សាគរុកោសល្យបឋមសិក្សានៅថ្ងៃធ្វើការ និងគណិតវិទ្យាអនុវត្តនៅចុងសប្តាហ៍ — ការអនុវត្តក្នុងថ្នាក់រៀននៅម្ខាង ការវែកញែកគណិតវិទ្យានៅម្ខាងទៀត ដែលទាំងពីរគាំទ្រការងារតែមួយក្នុងការបង្រៀន និងបច្ចេកវិទ្យាអប់រំ។",
      explore: "មើលការសិក្សារបស់ខ្ញុំ",
      publications: "មើលស្នាដៃបោះពុម្ព",
      pathLabel: "របៀបដែលបរិញ្ញាបត្រទាំងពីរជួបគ្នា",
      pathTeacher: "គរុកោសល្យ",
      pathTeacherDetail: "គរុកោសល្យ និងការអនុវត្តក្នុងថ្នាក់រៀន",
      pathMathematics: "គណិតវិទ្យាអនុវត្ត",
      pathMathematicsDetail: "ការវែកញែក ការវិភាគ និងរចនាសម្ព័ន្ធ",
      pathMission: "បទពិសោធន៍សិក្សាកាន់តែល្អ",
    },

    status: {
      inProgress: "កំពុងសិក្សា",
      expectedRange: "{start}—រំពឹងបញ្ចប់ {end}",
      expectedCompletion: "រំពឹងបញ្ចប់៖ ឆ្នាំ {year}",
    },

    spotlight: {
      eyebrow: "ការសិក្សាបច្ចុប្បន្ន",
      heading: "បរិញ្ញាបត្រពីរ បេសកកម្មអប់រំតែមួយ",
      teacherLabel: "គរុកោសល្យ",
      mathematicsLabel: "គណិតវិទ្យាអនុវត្ត",
      connection:
        "គរុកោសល្យជួយឱ្យខ្ញុំយល់ពីរបៀបដែលមនុស្សរៀន។ គណិតវិទ្យាពង្រឹងរបៀបដែលខ្ញុំវែកញែក ពន្យល់ និងដោះស្រាយបញ្ហា។",
      focusHeading: "ការផ្តោតបច្ចុប្បន្ន",
      viewDetails: "មើលព័ត៌មានលម្អិតនៃការសិក្សា",
      aboutHeading: "អំពីកម្មវិធីសិក្សានេះ",
      progressHeading: "ដំណាក់កាលនៃកម្មវិធី",
      institutionLink: "គេហទំព័រស្ថាប័ន",
    },

    week: {
      heading: "មួយសប្តាហ៍សិក្សា ស្ថាប័នពីរ",
      description:
        "កម្មវិធីទាំងពីរចែករំលែកសប្តាហ៍តែមួយ៖ គរុកោសល្យនៅថ្ងៃធ្វើការ គណិតវិទ្យានៅចុងសប្តាហ៍។",
      weekdays: "ថ្ងៃធ្វើការ",
      weekend: "ចុងសប្តាហ៍",
      /* ភាសាខ្មែរប្រើឈ្មោះថ្ងៃខ្លីធម្មតា — មិនមានទម្រង់អក្សរធំទេ។ */
      days: {
        mon: "ចន្ទ",
        tue: "អង្គារ",
        wed: "ពុធ",
        thu: "ព្រហ",
        fri: "សុក្រ",
        sat: "សៅរ៍",
        sun: "អាទិត្យ",
      },
    },

    topics: {
      pedagogy: "គរុកោសល្យ",
      lessonPlanning: "ការរៀបចំផែនការមេរៀន",
      assessment: "ការវាយតម្លៃសិស្ស",
      classroomPractice: "ការអនុវត្តក្នុងថ្នាក់រៀន",
      educationalResearch: "ការស្រាវជ្រាវអប់រំ",
      reasoning: "ការវែកញែកគណិតវិទ្យា",
      algebra: "ពិជគណិត",
      geometry: "ធរណីមាត្រ",
      analysis: "ការវិភាគ",
    },

    convergence: {
      eyebrow: "កន្លែងដែលពួកវាជួបគ្នា",
      heading: "អ្វីដែលខ្ញុំសិក្សា និងទីកន្លែងដែលវាទៅដល់",
      description:
        "កម្មវិធីទាំងពីរជួបគ្នានៅការអប់រំគណិតវិទ្យា — ហើយចំណុចជួបនោះត្រូវបានអនុវត្តតាមរយៈការបង្រៀន ការនិពន្ធ និងផលិតផលពិតប្រាកដ។",
      convergesInto: "ការអប់រំគណិតវិទ្យា",
      appliedThrough: "អនុវត្តតាមរយៈ",
      applications: {
        practice: {
          label: "ការបង្រៀនក្នុងថ្នាក់រៀន",
          detail: "កម្មសិក្សា និងការបំប៉នអនុវត្តគរុកោសល្យជាមួយសិស្សពិតប្រាកដ។",
        },
        publications: {
          label: "ស្នាដៃបោះពុម្ពគណិតវិទ្យា",
          detail: "សៀវភៅ និងកម្រងវិញ្ញាសាដែលបាននិពន្ធ និងរៀបចំសម្រាប់អ្នកសិក្សា។",
        },
        teacherTools: {
          label: "ឧបករណ៍គ្រូបង្រៀន",
          detail: "ការងារផលិតផលដែលរៀបចំតាមរបៀបដែលគ្រូរៀបចំផែនការ និងវាយតម្លៃជាក់ស្តែង។",
        },
        repositories: {
          label: "ឃ្លាំងឯកសារសិក្សា",
          detail: "ប្រព័ន្ធបណ្ណាល័យសម្រាប់រៀបចំ និងចូលប្រើឯកសារសិក្សា។",
        },
      },
    },

    fieldwork: {
      eyebrow: "ការងារចុះទីតាំង",
      heading: "អនុវត្តគរុកោសល្យហួសពីបន្ទប់បង្រៀន",
      partOf: "ជាផ្នែកនៃ",
      viewStory: "មើលរឿងរ៉ាវពេញលេញ",
    },

    milestone: {
      eyebrow: "សមិទ្ធផលសិក្សាថ្នាក់ជាតិ",
      gradeHeading: "និទ្ទេសរួម",
    },

    timeline: {
      eyebrow: "ផ្លូវមកដល់ទីនេះ",
      heading: "ការអប់រំមុនៗ និងអ្វីដែលនឹងមកដល់",
      listLabel: "សមិទ្ធផលអប់រំ តាមលំដាប់ពីមុនគេ",
      expectedMarker: "រំពឹងទុក",
      started: "ចាប់ផ្តើម{programme}",
      expected: "រំពឹងបញ្ចប់{programme}",
    },

    cta: {
      eyebrow: "បន្តទៅមុខ",
      heading: "ការសិក្សាក្លាយជាការបង្រៀន ការនិពន្ធ និងផលិតផល។",
      body: "មើលរបៀបដែលបរិញ្ញាបត្រទាំងពីរត្រូវបានអនុវត្ត — ក្នុងថ្នាក់រៀន ក្នុងស្នាដៃគណិតវិទ្យាដែលបានបោះពុម្ព និងក្នុងវេទិកាដែលខ្ញុំបង្កើត។",
      experience: "មើលបទពិសោធន៍",
      publications: "មើលស្នាដៃបោះពុម្ព",
    },

    kind: {
      high_school: "វិទ្យាល័យ",
      teacher_education: "ការបណ្តុះបណ្តាលគ្រូ",
      university: "សាកលវិទ្យាល័យ",
      professional_development: "ការអភិវឌ្ឍវិជ្ជាជីវៈ",
      certification: "វិញ្ញាបនបត្រ",
      other: "ផ្សេងទៀត",
    },
  },

  journey: {
    title: "ដំណើររបស់ខ្ញុំ",
    description:
      "ការងារចុះទីតាំង កម្មសិក្សាបង្រៀន ការផ្លាស់ប្តូរបទពិសោធន៍ រង្វាន់ និងព្រឹត្តិការណ៍ដែលបានរៀបចំរបៀបដែលខ្ញុំបង្រៀន និងបង្កើត។",
    eyebrow: "ដំណើររបស់ខ្ញុំ",
    emptyState: "រឿងរ៉ាវនៃដំណើរនឹងបង្ហាញនៅទីនេះ បន្ទាប់ពីត្រូវបានផ្សព្វផ្សាយ។",
    emptyHeading: "រឿងរ៉ាវកំពុងរៀបចំ",
    emptyBody:
      "រូបភាព និងវីដេអូត្រូវបានពិនិត្យឯកជនភាព មុនពេលផ្សព្វផ្សាយនៅទីនេះ។",

    featuredHeading: "រឿងរ៉ាវលេចធ្លោ",
    timelineHeading: "ដំណើរទាំងមូល",
    undatedHeading: "កាលបរិច្ឆេទត្រូវបញ្ជាក់",
    viewStory: "មើលរឿងរ៉ាវ",
    readStory: "អានរឿងរ៉ាវពេញលេញ",
    backToJourney: "ត្រឡប់ទៅដំណើរវិញ",

    searchLabel: "ស្វែងរករឿងរ៉ាវ",
    searchPlaceholder: "ស្វែងរកតាមចំណងជើង ទីកន្លែង ឬស្ថាប័ន",
    filterCategory: "ប្រភេទ",
    filterYear: "ឆ្នាំ",
    allCategories: "ប្រភេទទាំងអស់",
    allYears: "ឆ្នាំទាំងអស់",
    resultCount: "រឿងរ៉ាវ {count}",
    resultCountPlural: "រឿងរ៉ាវ {count}",
    noResults: "គ្មានរឿងរ៉ាវត្រូវនឹងតម្រងទាំងនេះទេ",
    noResultsHint: "សូមព្យាយាមដកតម្រងមួយចេញ ឬសម្អាតការស្វែងរក។",
    showFilters: "តម្រងរឿងរ៉ាវ",
    hideFilters: "លាក់តម្រង",
    loadMore: "បង្ហាញរឿងរ៉ាវបន្ថែម",

    organisation: "ស្ថាប័ន",
    location: "ទីតាំង",
    category: "ប្រភេទ",
    period: "ពេលវេលា",
    highlights: "ចំណុចសំខាន់ៗ",
    externalLink: "តំណពាក់ព័ន្ធ",
    photoCount: "រូបភាព {count}",
    photoCountPlural: "រូបភាព {count}",
    videoCount: "វីដេអូ {count}",
    videoCountPlural: "វីដេអូ {count}",

    relatedHeading: "អ្វីដែលរឿងនេះទាក់ទង",
    relatedExperience: "បទពិសោធន៍",
    relatedEducation: "ការសិក្សា",
    relatedCertificate: "វិញ្ញាបនបត្រ",
    relatedProject: "គម្រោង",

    previousStory: "រឿងរ៉ាវមុន",
    nextStory: "រឿងរ៉ាវបន្ទាប់",
    storyNavigation: "ការរុករករឿងរ៉ាវនៃដំណើរ",

    viewRelatedStory: "មើលរឿងរ៉ាវពាក់ព័ន្ធ",
    viewRelatedStories: "មើលរឿងរ៉ាវពាក់ព័ន្ធ",
    viewAllPhotos: "មើលរូបភាពទាំងអស់",
    fromJourney: "ពីដំណើររបស់ខ្ញុំ",

    gallery: {
      view: "មើលកម្រងរូបភាព",
      viewAll: "មើលរូបភាពទាំងអស់",
      title: "កម្រងរូបភាព — {entry}",
      previous: "រូបភាពមុន",
      next: "រូបភាពបន្ទាប់",
      close: "បិទកម្រងរូបភាព",
      position: "រូបភាពទី {current} ក្នុងចំណោម {total}",
      openItem: "បើក៖ {caption}",
      thumbnails: "រូបភាពតូចៗនៃកម្រង",
    },

    video: {
      play: "ចាក់វីដេអូ៖ {title}",
      playShort: "ចាក់វីដេអូ",
      loading: "កំពុងផ្ទុកកម្មវិធីចាក់វីដេអូ",
      duration: "រយៈពេល",
      transcript: "អត្ថបទប្រតិចារិក",
      showTranscript: "អានអត្ថបទប្រតិចារិក",
      hideTranscript: "លាក់អត្ថបទប្រតិចារិក",
      privacyNote:
        "ការចាក់វីដេអូនេះនឹងផ្ទុកវាពី {provider} ដែលអាចដាក់ខូឃី។",
      watchOn: "មើលនៅលើ {provider}",
      externalOnly: "វីដេអូនេះនឹងបើកនៅលើគេហទំព័រដែលផ្ទុកវា។",
      posterAlt: "រូបភាពគម្របសម្រាប់វីដេអូ “{title}”",
    },
  },

  publications: {
    title: "ស្នាដៃនិពន្ធ",
    description:
      "សៀវភៅគណិតវិទ្យា និងឯកសារសិក្សាដែលខ្ញុំបានរៀបរៀង និងវាយអត្ថបទដោយ LaTeX។",
    eyebrow: "ស្នាដៃរៀបរៀង",
    subtitle: "សៀវភៅគណិតវិទ្យា ឯកសារសិក្សា និងស្នាដៃដែលបានរៀបរៀងដោយ LaTeX",

    emptyState: "ស្នាដៃនិពន្ធនឹងបង្ហាញនៅទីនេះ បន្ទាប់ពីត្រូវបានផ្សព្វផ្សាយ។",
    emptyHeading: "សៀវភៅកំពុងរៀបចំ",
    emptyBody:
      "សៀវភៅនីមួយៗត្រូវបានពិនិត្យមុនផ្សព្វផ្សាយ ទាំងព័ត៌មានទំនាក់ទំនង រូបភាពរបស់ភាគីទីបី និងអ្វីៗដែលមិនគួរជាសាធារណៈ។",

    featuredHeading: "ស្នាដៃនិពន្ធសំខាន់ៗ",
    allHeading: "ស្នាដៃនិពន្ធទាំងអស់",
    viewPublication: "មើលស្នាដៃ",
    backToPublications: "ត្រឡប់ទៅស្នាដៃនិពន្ធ",

    searchLabel: "ស្វែងរកស្នាដៃនិពន្ធ",
    searchPlaceholder: "ស្វែងរកតាមចំណងជើង មុខវិជ្ជា ឬប្រធានបទ",
    filterType: "ប្រភេទ",
    filterSubject: "មុខវិជ្ជា",
    filterYear: "ឆ្នាំ",
    filterLevel: "កម្រិត",
    allTypes: "ប្រភេទទាំងអស់",
    allSubjects: "មុខវិជ្ជាទាំងអស់",
    allYears: "ឆ្នាំទាំងអស់",
    allLevels: "កម្រិតទាំងអស់",
    resultCount: "ស្នាដៃ {count}",
    resultCountPlural: "ស្នាដៃ {count}",
    noResults: "គ្មានស្នាដៃត្រូវនឹងតម្រងទាំងនេះ",
    noResultsHint: "សូមដកតម្រងចេញ ឬសម្អាតការស្វែងរក។",
    showFilters: "តម្រងស្នាដៃ",
    hideFilters: "លាក់តម្រង",
    clearFilters: "សម្អាតតម្រង",

    originalTitle: "ចំណងជើងដើម",
    type: "ប្រភេទ",
    subject: "មុខវិជ្ជា",
    level: "កម្រិត",
    audience: "សម្រាប់អ្នកណា",
    edition: "បោះពុម្ពលើកទី",
    year: "ឆ្នាំ",
    language: "ភាសានៃសៀវភៅ",
    pages: "ទំព័រ",
    pageCount: "{count} ទំព័រ",
    pageCountPlural: "{count} ទំព័រ",
    topics: "ប្រធានបទ",
    author: "អ្នកនិពន្ធ",

    languageKm: "ភាសាខ្មែរ",
    languageEn: "ភាសាអង់គ្លេស",
    languageBilingual: "ខ្មែរ និងអង់គ្លេស",
    languageOther: "ភាសាផ្សេង",

    levelLowerSecondary: "មធ្យមសិក្សាបឋមភូមិ",
    levelUpperSecondary: "មធ្យមសិក្សាទុតិយភូមិ",
    levelUniversity: "សាកលវិទ្យាល័យ",
    levelTeacher: "សម្រាប់គ្រូបង្រៀន",
    levelGeneral: "ទូទៅ",

    aboutHeading: "អំពីសៀវភៅនេះ",
    introductionHeading: "សេចក្ដីផ្ដើម",
    objectivesHeading: "អ្វីដែលអ្នកនឹងរៀន",
    authorNoteHeading: "សារពីអ្នកនិពន្ធ",
    acknowledgementsHeading: "សេចក្ដីថ្លែងអំណរគុណ",
    contentsHeading: "មាតិកា",
    samplePagesHeading: "ទំព័រគំរូ",
    galleryHeading: "ពីក្នុងសៀវភៅ",
    editionsHeading: "ប្រវត្តិការបោះពុម្ព",
    citationHeading: "របៀបដកស្រង់",
    licenceHeading: "អាជ្ញាបណ្ណ និងការប្រើប្រាស់",
    productionHeading: "របៀបរៀបចំ",
    relatedHeading: "ស្នាដៃពាក់ព័ន្ធ",
    relatedPublicationsHeading: "ស្នាដៃនិពន្ធផ្សេងទៀត",

    chapterPages: "ទំព័រ {start}–{end}",
    chapterPage: "ទំព័រ {start}",

    previewHeading: "អានគំរូ",
    openPreview: "បើកកម្មវិធីអាន",
    closePreview: "បិទកម្មវិធីអាន",
    previewNotAvailable: "គ្មានការមើលជាមុនសម្រាប់ស្នាដៃនេះទេ។",
    previewSampleOnly: "ការមើលជាមុននេះបង្ហាញតែទំព័រគំរូដែលបានជ្រើសរើសប៉ុណ្ណោះ។",
    previewFirstPages: "ការមើលជាមុននេះបង្ហាញទំព័រដំបូង {count} ទំព័រ។",
    previewFull: "ការមើលជាមុននេះបង្ហាញសៀវភៅទាំងមូល។",
    previewLoading: "កំពុងផ្ទុកកម្មវិធីអាន…",
    previewFailed: "មិនអាចផ្ទុកកម្មវិធីអានបានទេ។",
    previewFallback: "ទាញយក PDF ជំនួសវិញ",
    previewPage: "ទំព័រ {page}",
    previewPageOf: "ទំព័រ {page} ក្នុងចំណោម {total}",
    previewNextPage: "ទំព័របន្ទាប់",
    previewPreviousPage: "ទំព័រមុន",
    previewZoomIn: "ពង្រីក",
    previewZoomOut: "បង្រួម",
    previewFullscreen: "ពេញអេក្រង់",
    previewExitFullscreen: "ចាកចេញពីពេញអេក្រង់",
    previewKeyboardHint:
      "ប្រើគ្រាប់ចុចព្រួញឆ្វេង និងស្ដាំដើម្បីបើកទំព័រ ហើយ Escape ដើម្បីបិទ។",

    download: "ទាញយក",
    downloadPdf: "ទាញយក PDF",
    downloadLabel: "ទាញយក PDF ({size})",
    downloadEdition: "ទាញយកការបោះពុម្ពនេះ",
    downloadNotAvailable: "ស្នាដៃនេះមិនអាចទាញយកបានទេ។",
    downloadOnRequest: "អាចស្នើសុំបាន",
    downloadOnRequestBody: "សូមទាក់ទងមកខ្ញុំ ហើយខ្ញុំនឹងផ្ញើច្បាប់ចម្លងជូន។",
    downloadContactAuthor: "ទាក់ទងអ្នកនិពន្ធដើម្បីទទួលច្បាប់ចម្លង",
    contactAboutThis: "សួរអំពីស្នាដៃនេះ",
    fileMeta: "{type}, {size}",

    samplePagesBody: "ទំព័រមួយចំនួនពីក្នុងសៀវភៅ ដែលអ្នកនិពន្ធបានជ្រើសរើស។",
    samplePageOf: "ទំព័រ {page}",
    openSamplePage: "មើលទំព័រនេះធំជាង",

    currentEdition: "ការបោះពុម្ពបច្ចុប្បន្ន",
    previousEdition: "ការបោះពុម្ពមុន",
    editionChangelog: "អ្វីដែលបានផ្លាស់ប្ដូរ",
    editionNoChangelog: "គ្មានកំណត់ចំណាំសម្រាប់ការបោះពុម្ពនេះទេ។",

    copyCitation: "ចម្លងការដកស្រង់",
    citationCopied: "បានចម្លងការដកស្រង់",
    copyBibtex: "ចម្លង BibTeX",
    bibtexCopied: "បានចម្លង BibTeX",
    citationNote:
      "ការដកស្រង់នេះបង្កើតចេញពីព័ត៌មានដែលបានកត់ត្រា។ សូមផ្ទៀងផ្ទាត់ជាមួយបទដ្ឋានរបស់អ្នក។",

    licenceAllRightsReserved: "រក្សាសិទ្ធិគ្រប់យ៉ាង",
    licencePersonalEducational: "ប្រើដោយសេរីសម្រាប់ការសិក្សា និងផ្ទាល់ខ្លួន",
    licenceNonCommercial: "ប្រើដោយសេរីមិនមែនពាណិជ្ជកម្ម",
    licenceCcBy: "Creative Commons Attribution 4.0",
    licenceCcBySa: "Creative Commons Attribution-ShareAlike 4.0",
    licenceCcByNd: "Creative Commons Attribution-NoDerivatives 4.0",
    licenceCcByNc: "Creative Commons Attribution-NonCommercial 4.0",
    licenceCcByNcSa: "Creative Commons Attribution-NonCommercial-ShareAlike 4.0",
    licenceCcByNcNd: "Creative Commons Attribution-NonCommercial-NoDerivatives 4.0",
    licenceCc0: "Creative Commons Zero (ជាសម្បត្តិសាធារណៈ)",
    licencePublicDomain: "សម្បត្តិសាធារណៈ",
    licenceCustom: "លក្ខខណ្ឌផ្ទាល់ខ្លួន",
    licenceReadTerms: "អានអាជ្ញាបណ្ណ",
    copyright: "© {year} {holder}",
    redistributionAllowed: "អ្នកអាចចែករំលែកច្បាប់ចម្លងបាន។",
    redistributionNotAllowed: "សូមភ្ជាប់តំណមកទំព័រនេះ ជំនួសឱ្យការចែករំលែកច្បាប់ចម្លង។",
    modificationAllowed: "អ្នកអាចកែសម្រួលបាន។",
    modificationNotAllowed: "សូមកុំផ្សព្វផ្សាយកំណែដែលបានកែសម្រួល។",

    latexBadge: "LaTeX",
    latexHeading: "រៀបចំដោយប្រើ LaTeX",
    latexEngine: "ម៉ាស៊ីនចងក្រង",
    latexDocumentClass: "ថ្នាក់ឯកសារ",
    latexBuildYear: "វាយអត្ថបទក្នុងឆ្នាំ",
    latexSource: "កូដដើម",
    latexSourcePrivate: "កូដដើមមិនត្រូវបានផ្សព្វផ្សាយទេ។",
    latexSourceOnRequest: "កូដដើមអាចស្នើសុំបាន។",
    latexSourcePublic: "ទាញយកកូដដើម LaTeX",
    latexSourceRepository: "មើលឃ្លាំងកូដដើម",
    latexSourceRequestCta: "ស្នើសុំកូដដើម",

    relatedJourney: "រឿងរ៉ាវដំណើរ",
    relatedExperience: "បទពិសោធន៍",
    relatedEducation: "ការអប់រំ",
    relatedCertificate: "វិញ្ញាបនបត្រ",
    relatedProject: "គម្រោង",
    viewRelatedPublication: "មើលស្នាដៃពាក់ព័ន្ធ",
    viewRelatedPublications: "មើលស្នាដៃពាក់ព័ន្ធ",

    previousPublication: "ស្នាដៃមុន",
    nextPublication: "ស្នាដៃបន្ទាប់",
    publicationNavigation: "ការរុករកស្នាដៃនិពន្ធ",
  },

  contact: {
    title: "ទំនាក់ទំនង",
    description:
      "ទាក់ទងអំពីការបង្រៀន ការជួយបំប៉ន វេទិកាសិក្សា ឬកិច្ចសហការលើផលិតផល។",
    formHeading: "ផ្ញើសារ",
    directHeading: "ទាក់ទងខ្ញុំដោយផ្ទាល់",
    moreDetails: "បន្ថែមព័ត៌មានលម្អិត",
    moreDetailsHint: "ជាជម្រើស — ជួយឱ្យខ្ញុំឆ្លើយតបបានត្រង់ចំណុច។",
    fields: {
      name: "ឈ្មោះរបស់អ្នក",
      namePlaceholder: "សុខ តារា",
      email: "អ៊ីមែលរបស់អ្នក",
      emailPlaceholder: "you@example.com",
      organization: "ស្ថាប័ន",
      organizationPlaceholder: "សាលា សាកលវិទ្យាល័យ ឬក្រុមហ៊ុន",
      subject: "ប្រធានបទ",
      subjectPlaceholder: "អំពីអ្វី?",
      projectType: "អំពីអ្វី?",
      preferredContact: "វិធីឆ្លើយតបដែលចង់បាន",
      message: "សាររបស់អ្នក",
      messagePlaceholder: "សូមប្រាប់ខ្ញុំបន្តិចអំពីអ្វីដែលអ្នកកំពុងគិត…",
      consent:
        "ខ្ញុំយល់ព្រមឱ្យរក្សាទុកសារ និងអាសយដ្ឋានអ៊ីមែលរបស់ខ្ញុំ ដើម្បីឱ្យរស្មីអាចឆ្លើយតបបាន។",
    },
    projectTypes: {
      teaching: "តួនាទីបង្រៀន",
      tutoring: "ការជួយបំប៉ន",
      collaboration: "កិច្ចសហការ",
      development: "ការបង្កើតអ្វីមួយ",
      speaking: "ការធ្វើបទបង្ហាញ ឬសិក្ខាសាលា",
      academic: "រឿងទាក់ទងការសិក្សា",
      other: "រឿងផ្សេងទៀត",
    },
    preferredContact: {
      email: "អ៊ីមែល",
      telegram: "តេឡេក្រាម",
      either: "មួយណាក៏បាន",
    },
    submit: "ផ្ញើសារ",
    submitting: "កំពុងផ្ញើ…",
    successHeading: "បានទទួលសារ",
    successBody:
      "សាររបស់អ្នកត្រូវបានរក្សាទុក ហើយខ្ញុំនឹងអាន។ ខ្ញុំតាមធម្មតាឆ្លើយតបក្នុងរយៈពេលពីរបីថ្ងៃ។",
    successBodyNotified:
      "សាររបស់អ្នកត្រូវបានរក្សាទុក ហើយការជូនដំណឹងត្រូវបានផ្ញើ។ ខ្ញុំតាមធម្មតាឆ្លើយតបក្នុងរយៈពេលពីរបីថ្ងៃ។",
    sendAnother: "ផ្ញើសារមួយទៀត",
    errorHeading: "សារមិនអាចផ្ញើបានទេ",
    errorGeneric:
      "មានបញ្ហាកើតឡើងនៅខាងខ្ញុំ។ សូមព្យាយាមម្តងទៀត ឬផ្ញើអ៊ីមែលមកខ្ញុំដោយផ្ទាល់។",
    errorNetwork: "ការតភ្ជាប់របស់អ្នកបានដាច់មុនពេលសារត្រូវបានផ្ញើ។ សូមព្យាយាមម្តងទៀត។",
    errorValidation: "សូមពិនិត្យប្រអប់ដែលបានរំលេច ហើយព្យាយាមម្តងទៀត។",
    errorSummaryHeading: "មានបញ្ហា {count} ជាមួយសាររបស់អ្នក",
    rateLimited: "សូមរង់ចាំ {time} មុនផ្ញើសារម្តងទៀត។",
    rateLimitedHourly: "អ្នកបានឈានដល់ដែនកំណត់ក្នុងមួយម៉ោង។ សូមព្យាយាមម្តងទៀតក្នុង {time}។",
    validation: {
      nameRequired: "សូមបញ្ចូលឈ្មោះរបស់អ្នក។",
      nameTooLong: "ឈ្មោះរបស់អ្នកត្រូវមានតួអក្សរមិនលើស ១០០។",
      emailRequired: "សូមបញ្ចូលអាសយដ្ឋានអ៊ីមែលរបស់អ្នក។",
      emailInvalid: "សូមបញ្ចូលអ៊ីមែលត្រឹមត្រូវ ដូចជា you@example.com។",
      messageRequired: "សូមបញ្ចូលសារ។",
      messageTooShort: "សូមសរសេរយ៉ាងតិច ១០ តួអក្សរ ដើម្បីឱ្យខ្ញុំយល់ពីសំណើរបស់អ្នក។",
      messageTooLong: "សាររបស់អ្នកត្រូវមានតួអក្សរមិនលើស ២,០០០។",
      subjectTooLong: "ប្រធានបទត្រូវមានតួអក្សរមិនលើស ១៥០។",
      organizationTooLong: "ស្ថាប័នត្រូវមានតួអក្សរមិនលើស ១៥០។",
      consentRequired: "សូមបញ្ជាក់ចំណុចនេះ ដើម្បីឱ្យខ្ញុំអាចឆ្លើយតបបាន។",
    },
    charactersRemaining: "នៅសល់ {count} តួអក្សរ",
    directEmail: "អ៊ីមែល",
    directTelegram: "តេឡេក្រាម",
    responseTime: "ខ្ញុំអានសារទាំងអស់ដោយខ្លួនឯង ដូច្នេះការឆ្លើយតបត្រូវការពេលពីរបីថ្ងៃ។",
  },

  common: {
    readMore: "អានបន្ថែម",
    showMore: "បង្ហាញបន្ថែម",
    showLess: "បង្ហាញតិច",
    viewAll: "មើលទាំងអស់",
    back: "ត្រឡប់",
    close: "បិទ",
    cancel: "បោះបង់",
    retry: "ព្យាយាមម្តងទៀត",
    copy: "ចម្លង",
    copied: "បានចម្លង",
    search: "ស្វែងរក",
    clear: "សម្អាត",
    yes: "បាទ/ចាស",
    no: "ទេ",
    and: "និង",
    featured: "លេចធ្លោ",
    new: "ថ្មី",
    updatedOn: "ធ្វើបច្ចុប្បន្នភាព {date}",
    publishedOn: "ផ្សព្វផ្សាយ {date}",
    pageOf: "ទំព័រ {current} ក្នុង {total}",
    present: "បច្ចុប្បន្ន",
    notSpecified: "មិនបានបញ្ជាក់",
  },

  errors: {
    notFoundTitle: "ទំព័រនេះមិនមានទេ",
    notFoundBody:
      "តំណភ្ជាប់អាចហួសសម័យ ឬទំព័រអាចត្រូវបានប្តូរឈ្មោះ។ តំណខាងក្រោមគួរជួយបាន។",
    notFoundProjects: "មើលគម្រោងទាំងអស់",
    notFoundCertificates: "មើលវិញ្ញាបនបត្រទាំងអស់",
    notFoundHome: "ទៅទំព័រដើម",
    genericTitle: "មានបញ្ហាកើតឡើង",
    genericBody:
      "ទំព័រនេះមិនអាចផ្ទុកបានទេ។ ការផ្ទុកឡើងវិញតាមធម្មតាដោះស្រាយបាន។ ប្រសិនបើវាបន្តកើតឡើង សូមប្រាប់ខ្ញុំ។",
    reload: "ផ្ទុកទំព័រឡើងវិញ",
    offlineTitle: "អ្នកហាក់ដូចជាគ្មានអ៊ីនធឺណិត",
    offlineBody: "សូមពិនិត្យការតភ្ជាប់របស់អ្នក ហើយព្យាយាមម្តងទៀត។",
  },

  footer: {
    tagline: "អ្នកអប់រំ និស្សិតគណិតវិទ្យា និងអ្នកបង្កើតផលិតផលឌីជីថល។",
    availability: "អាចរួមសហការលើការអប់រំ និងផលិតផលឌីជីថល។",
    navHeading: "ទំព័រ",
    connectHeading: "ភ្ជាប់ទំនាក់ទំនង",
    legalHeading: "អំពីគេហទំព័រនេះ",
    builtWith: "បង្កើតដោយ Next.js, Supabase និង Cloudflare។",
    sourceNote: "ខ្លឹមសារត្រូវបានគ្រប់គ្រងតាមផ្ទាំងគ្រប់គ្រងឯកជន។",
    copyright: "© {year} រុន រស្មី",
    backToTop: "ត្រឡប់ទៅខាងលើ",
  },

  theme: {
    light: "ភ្លឺ",
    dark: "ងងឹត",
    system: "តាមប្រព័ន្ធ",
  },
};
