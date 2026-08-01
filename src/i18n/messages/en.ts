/**
 * English message catalogue — the source of truth for the UI string shape.
 *
 * `km.ts` is typed against this object, so a missing or misspelled Khmer key is
 * a compile error rather than a blank label discovered in production. UI chrome
 * lives here; editorial content lives in the CMS translation tables.
 */
export const en = {
  meta: {
    siteName: "Ron Raksmey",
    localeName: "English",
  },

  a11y: {
    skipToContent: "Skip to main content",
    mainNavigation: "Main navigation",
    breadcrumb: "Breadcrumb",
    openMenu: "Open navigation menu",
    closeMenu: "Close navigation menu",
    toggleTheme: "Switch colour theme",
    themeLight: "Switch to light theme",
    themeDark: "Switch to dark theme",
    switchLanguage: "Change language",
    currentPage: "Current page",
    opensInNewTab: "opens in a new tab",
    externalLink: "external link",
    loading: "Loading",
    required: "required",
    optional: "optional",
    closeDialog: "Close dialogue",
    previous: "Previous",
    next: "Next",
    pagination: "Pagination",
    sortBy: "Sort by",
    filters: "Filters",
    clearFilters: "Clear all filters",
    resultsUpdated: "Results updated",
    fileTypeAndSize: "{type}, {size}",
  },

  nav: {
    home: "Home",
    projects: "Projects",
    certificates: "Certificates",
    experience: "Experience",
    journey: "Journey",
    publications: "Publications",
    education: "Education",
    about: "About",
    resume: "Resume",
    contact: "Contact",
    downloadResume: "Download Resume",
  },

  home: {
    hero: {
      eyebrow: "Educator · Mathematics · Software Engineering",
      greeting: "Hello, I'm",
      /*
       * The two-line positioning statement. Kept as two keys rather than one
       * string with a newline so each line can be its own block element: the
       * hero sets a very tight line-height, and a <br> inside a balanced
       * text-wrap heading breaks unpredictably at Khmer's taller leading.
       */
      roleLine1: "Educator by purpose.",
      roleLine2: "Product builder by practice.",
      intro:
        "I design and build practical digital products for education, teaching and access to academic resources.",
      buildsLabel: "I build",
      /*
       * The rotating phrases. An object rather than an array because the
       * Dictionary type maps strings recursively and would turn an array into
       * an object with numeric keys anyway — this way the keys are readable and
       * a missing Khmer phrase is still a compile error.
       */
      builds: {
        libraries: "digital libraries",
        platforms: "education platforms",
        tools: "teacher tools",
        systems: "academic systems",
      },
      exploreWork: "Explore My Work",
      viewProjects: "View My Projects",
      downloadResume: "Download Resume",
      contactMe: "Contact Me",
      availableForWork: "Open to opportunities",
      notAvailable: "Not currently taking new work",
      basedIn: "Based in {location}",
      speaks: "Speaks",
      portraitAlt: "Portrait of Ron Raksmey",
      scrollCue: "Scroll to explore",
    },

    about: {
      eyebrow: "About",
      heading: "Two practices, one purpose",
      body: "I train as a primary-school teacher and study mathematics, and I build the software that teachers and students actually use. The teaching tells me what the tools have to do; the engineering makes it exist.",
      factsHeading: "At a glance",
      focusHeading: "Current focus",
      locationLabel: "Based in",
      languagesLabel: "Languages",
      readMore: "More about me",
    },
    credibility: {
      heading: "At a glance",
      note: "Counted from published content on this site.",
      publishedProjects: "Published projects",
      certificates: "Certificates",
      yearsJourney: "Years on this journey",
      languages: "Languages",
      experiences: "Roles and placements",
    },
    featured: {
      eyebrow: "Selected work",
      heading: "Projects I have designed and built",
      description:
        "Real systems, in production, used in a teacher-education context. Each one has a full case study.",
      viewCaseStudy: "View case study",
      visitLive: "Visit live project",
      viewAll: "View all projects",
      empty: "Featured projects will appear here once they are published.",
      /*
       * The empty state is deliberately not "there are no projects yet". The
       * platforms exist and are live; only the written case studies are
       * outstanding, so the copy says that and then links to the real things.
       */
      emptyHeading: "Case studies are being prepared",
      emptyBody: "Explore my live platforms in the meantime.",
      liveNow: "Live",
    },
    capabilities: {
      eyebrow: "What I do",
      heading: "Capabilities, with the work that demonstrates them",
      description:
        "No self-assessed scores. Each capability links to the projects and credentials that evidence it.",
      evidencedBy: "Evidenced by",
      noEvidenceYet: "No linked project yet",
    },
    certificates: {
      eyebrow: "Credentials",
      heading: "Certificates and academic achievements",
      viewCredential: "View credential",
      viewAll: "View all certificates",
      empty: "Certificates will appear here once they have been reviewed and published.",
      emptyHeading: "Credentials are in privacy review",
      emptyBody:
        "Certificates are published here once personal identifiers have been removed.",
    },
    journey: {
      eyebrow: "Education and journey",
      heading: "How I got here",
      present: "Present",
      expected: "expected",
      viewAll: "View full experience",
    },
    /*
     * The homepage's curated strip of journey stories. Distinct from
     * `home.journey` above, which is the education/experience timeline — that
     * one answers "what has he done", this one answers "what did it look like".
     */
    moments: {
      eyebrow: "Journey",
      heading: "Selected moments from my journey",
      description:
        "Fieldwork, teaching practice, exchanges and the events along the way.",
      viewStory: "View story",
      viewAll: "View the full journey",
    },
    /*
     * The homepage's curated strip of authored books. Three or four, never the
     * whole shelf — the Publications page holds the rest, and the homepage's job
     * is to establish that these exist rather than to be a catalogue.
     */
    publications: {
      eyebrow: "Authored work",
      heading: "Selected publications",
      description:
        "Mathematics books and learning materials I have written and typeset with LaTeX.",
      viewPublication: "View publication",
      viewAll: "View all publications",
    },
    testimonials: {
      eyebrow: "References",
      heading: "What colleagues say",
      relationshipLabel: "Relationship",
      empty: "References will appear here once they have been confirmed.",
    },
    cta: {
      heading: "Let's build something meaningful.",
      description:
        "Have an education, teaching or digital-product idea? I am open to teaching roles, tutoring, and building academic platforms.",
      emailMe: "Email me",
      openContactForm: "Send a message",
      telegram: "Message on Telegram",
    },
  },

  projects: {
    title: "Projects and case studies",
    description:
      "Education and academic platforms I have designed, built and shipped.",
    searchLabel: "Search projects",
    searchPlaceholder: "Search by name, problem or technology",
    filterCategory: "Category",
    filterTechnology: "Technology",
    filterStatus: "Status",
    allCategories: "All categories",
    allTechnologies: "All technologies",
    allStatuses: "All statuses",
    featuredOnly: "Featured only",
    resultCount: "{count} project",
    resultCountPlural: "{count} projects",
    noResults: "No projects match these filters",
    noResultsHint: "Try removing a filter or clearing your search.",
    emptyState: "There are no published projects yet.",
    emptyHeading: "Case studies are being prepared",
    emptyBody:
      "The platforms below are live and in daily use. Written case studies are being added.",
    exploreLive: "Explore my live platforms",
    screenshotAlt: "Screenshot of the {name} home page",
    showFilters: "Filter projects",
    hideFilters: "Hide filters",
    loadMore: "Load more projects",
    role: "Role",
    organization: "Organisation",
    year: "Year",
    teamSize: "Team size",
    duration: "Duration",
    status: "Status",
    technologies: "Technology stack",
    liveSite: "Live site",
    repository: "Repository",
    caseStudy: "Case study",
    backToProjects: "All projects",
    onThisPage: "On this page",
    notConfirmed: "Not yet confirmed",
    translationFallback:
      "This case study has not been translated yet, so it is shown in English.",
    projectStatus: {
      live: "Live",
      in_development: "In development",
      maintained: "Maintained",
      sunset: "Sunset",
      concept: "Concept",
    },
    sections: {
      overview: "Overview",
      problem: "The problem",
      targetUsers: "Who it is for",
      goals: "Goals",
      myRole: "My role",
      responsibilities: "Responsibilities",
      constraints: "Constraints",
      research: "Research and discovery",
      uxDecisions: "UX decisions",
      architecture: "Architecture",
      databaseDecisions: "Database decisions",
      keyFeatures: "Key features",
      security: "Security",
      accessibility: "Accessibility",
      seo: "SEO",
      performance: "Performance",
      challenges: "Challenges",
      solution: "Solution",
      results: "Results",
      lessons: "What I learned",
      nextSteps: "Next improvements",
      gallery: "Screenshots",
      metrics: "Measured results",
    },
    metrics: {
      heading: "Measured results",
      note: "Only figures with a recorded source are shown.",
      measuredOn: "Measured {date}",
      none: "No verified figures have been recorded for this project yet.",
    },
    gallery: {
      desktop: "Desktop",
      mobile: "Mobile",
      diagram: "Diagram",
      before: "Before",
      after: "After",
    },
  },

  certificates: {
    title: "Certificates and academic achievements",
    description:
      "Verified credentials, academic awards and teacher-education certificates.",
    searchLabel: "Search certificates",
    searchPlaceholder: "Search by title or issuer",
    filterCategory: "Category",
    filterIssuer: "Issuer",
    filterYear: "Year",
    allCategories: "All categories",
    allIssuers: "All issuers",
    allYears: "All years",
    resultCount: "{count} certificate",
    resultCountPlural: "{count} certificates",
    noResults: "No certificates match these filters",
    emptyState: "Certificates will appear here once they have been published.",
    emptyHeading: "Credentials are in privacy review",
    emptyBody:
      "Certificates and academic credentials are added here after personal identifiers have been removed.",
    /* Short enough to sit inline beside a shield icon rather than in a banner. */
    privacyShort: "Public previews have sensitive personal information removed.",
    showFilters: "Filter certificates",
    featuredCredential: "Featured credential",
    issuer: "Issued by",
    issuedOn: "Issued",
    expiresOn: "Expires",
    noExpiry: "No expiry",
    credentialId: "Credential ID",
    category: "Category",
    skills: "Skills demonstrated",
    verify: "Verify credential",
    verifyUnavailable: "No online verification available",
    download: "Download certificate",
    downloadUnavailable: "This document is not available for download",
    relatedProjects: "Related projects",
    relatedEducation: "Related education",
    backToCertificates: "All certificates",
    previewAlt: "Preview of {title}",
    previewNote:
      "Previews are redacted copies. Personal identifiers are removed before publication.",
    documentSummary: "What this document shows",
    status: {
      active: "Active",
      expired: "Expired",
      revoked: "Revoked",
      unverified: "Awaiting verification",
    },
  },

  resume: {
    title: "Resume",
    description: "Read the current resume online, or download it as a PDF.",
    download: "Download PDF",
    print: "Print",
    lastUpdated: "Last updated {date}",
    currentVersion: "Current version: {label}",
    noResume: "No resume has been published yet.",
    noResumeForLocale:
      "A {language} resume is not available yet. Showing the {fallback} version.",
    viewOtherLanguage: "View the {language} version",
    sections: {
      profile: "Profile",
      education: "Education",
      experience: "Experience",
      projects: "Projects",
      certificates: "Certificates",
      skills: "Skills",
      languages: "Languages",
      contact: "Contact",
    },
  },

  about: {
    title: "About",
    positioningHeading: "Educator, mathematics student and full-stack product builder",
    twoIdentities: "Two halves of the same practice",
    educationIdentity: "Education",
    technologyIdentity: "Technology and product",
    languagesHeading: "Languages",
    locationHeading: "Location",
    capabilitiesHeading: "Capabilities",
    referencesHeading: "References",
  },

  experience: {
    title: "Experience",
    description: "Teaching practice, student-teacher training and product work.",
    current: "Current",
    emptyState: "Experience entries will appear here once published.",
    kind: {
      teaching: "Teaching",
      practicum: "Practicum",
      development: "Development",
      volunteer: "Volunteer",
      leadership: "Leadership",
      tutoring: "Tutoring",
      other: "Other",
    },
    achievements: "Highlights",
    /*
     * Photograph gallery.
     *
     * `openPhoto` and `position` are the two that matter for assistive
     * technology: the first names each thumbnail by what it shows rather than
     * "image", and the second is announced on every navigation, since moving
     * between photos does not move focus.
     */
    photos: {
      view: "View photos",
      viewAll: "View all photos",
      galleryTitle: "Photo gallery — {entry}",
      previous: "Previous photo",
      next: "Next photo",
      close: "Close gallery",
      position: "Photo {current} of {total}",
      openPhoto: "Open photo: {caption}",
    },
  },

  education: {
    title: "Education",
    description: "Teacher education, mathematics study and school qualifications.",
    emptyState: "Education entries will appear here once published.",
    qualification: "Qualification",
    fieldOfStudy: "Field of study",
    schedule: "Schedule",
    grade: "Result",
    gradeScale: "Scale",
    current: "In progress",
    kind: {
      high_school: "High school",
      teacher_education: "Teacher education",
      university: "University",
      professional_development: "Professional development",
      certification: "Certification",
      other: "Other",
    },
  },

  /*
   * Journey.
   *
   * Two groups matter for assistive technology and are worth reading before
   * editing:
   *
   *  · `gallery.*` — `openItem` names each thumbnail by what it shows rather
   *    than "image", and `position` is announced on every navigation, because
   *    moving between photographs does not move focus and a screen-reader user
   *    would otherwise hear nothing at all when they press Next.
   *
   *  · `video.*` — `play` is the accessible name of the button that replaces the
   *    poster with the player. It interpolates the video's own title, so the
   *    control says what will start rather than just "Play".
   */
  journey: {
    title: "Journey",
    description:
      "Fieldwork, teaching practice, exchanges, awards and the events that shaped how I teach and build.",
    eyebrow: "My journey",
    emptyState: "Journey stories will appear here once they are published.",
    emptyHeading: "Stories are being prepared",
    emptyBody:
      "Photographs and video are reviewed for privacy before anything is published here.",

    featuredHeading: "Featured stories",
    timelineHeading: "The full journey",
    undatedHeading: "Date to be confirmed",
    viewStory: "View story",
    readStory: "Read the full story",
    backToJourney: "Back to the journey",

    // Filters. Shown progressively — see the note in journey-filters.tsx.
    searchLabel: "Search stories",
    searchPlaceholder: "Search by title, place or organisation",
    filterCategory: "Category",
    filterYear: "Year",
    allCategories: "All categories",
    allYears: "All years",
    resultCount: "{count} story",
    resultCountPlural: "{count} stories",
    noResults: "No stories match these filters",
    noResultsHint: "Try removing a filter or clearing your search.",
    showFilters: "Filter stories",
    hideFilters: "Hide filters",
    loadMore: "Show more stories",

    // Entry metadata
    organisation: "Organisation",
    location: "Location",
    category: "Category",
    period: "When",
    highlights: "Highlights",
    externalLink: "Related link",
    photoCount: "{count} photo",
    photoCountPlural: "{count} photos",
    videoCount: "{count} video",
    videoCountPlural: "{count} videos",

    // Relations
    relatedHeading: "What this connects to",
    relatedExperience: "Experience",
    relatedEducation: "Education",
    relatedCertificate: "Certificate",
    relatedProject: "Project",

    // Prev / next
    previousStory: "Previous story",
    nextStory: "Next story",
    storyNavigation: "Journey story navigation",

    // Cross-links from the other pages
    viewRelatedStory: "View the related story",
    viewRelatedStories: "View related stories",
    viewAllPhotos: "View all photos",
    fromJourney: "From my journey",

    gallery: {
      view: "View gallery",
      viewAll: "View all photos",
      title: "Gallery — {entry}",
      previous: "Previous photo",
      next: "Next photo",
      close: "Close gallery",
      position: "Photo {current} of {total}",
      openItem: "Open: {caption}",
      thumbnails: "Gallery thumbnails",
    },

    video: {
      play: "Play video: {title}",
      playShort: "Play video",
      loading: "Loading the video player",
      duration: "Length",
      transcript: "Transcript",
      showTranscript: "Read the transcript",
      hideTranscript: "Hide the transcript",
      /*
       * Shown on the facade before the player is loaded. The point is consent:
       * nothing is requested from the video platform until the visitor asks for
       * it, and they are told that is what pressing Play does.
       */
      privacyNote:
        "Playing this loads the video from {provider}, which may set cookies.",
      watchOn: "Watch on {provider}",
      /*
       * Used when the video is hosted somewhere this site will not put in an
       * iframe. Framing an arbitrary origin is how a page ends up framing
       * something hostile, so it links out instead.
       */
      externalOnly: "This video opens on the site that hosts it.",
      posterAlt: "Poster frame for the video “{title}”",
    },
  },

  publications: {
    title: "Publications",
    description:
      "Mathematics books and learning materials I have written and typeset with LaTeX.",
    eyebrow: "Authored work",
    subtitle: "Mathematics books, learning materials and LaTeX publications",

    emptyState: "Publications will appear here once they are published.",
    emptyHeading: "Books are being prepared",
    emptyBody:
      "Every book is reviewed before it is published here — for contact details, third-party figures and anything that should not be public.",

    // Listing
    featuredHeading: "Selected publications",
    allHeading: "All publications",
    viewPublication: "View publication",
    backToPublications: "Back to publications",

    // Filters. Shown progressively — see the note in publication-filters.tsx.
    searchLabel: "Search publications",
    searchPlaceholder: "Search by title, subject or topic",
    filterType: "Type",
    filterSubject: "Subject",
    filterYear: "Year",
    filterLevel: "Level",
    allTypes: "All types",
    allSubjects: "All subjects",
    allYears: "All years",
    allLevels: "All levels",
    resultCount: "{count} publication",
    resultCountPlural: "{count} publications",
    noResults: "No publications match these filters",
    noResultsHint: "Try removing a filter or clearing your search.",
    showFilters: "Filter publications",
    hideFilters: "Hide filters",
    clearFilters: "Clear filters",

    // Metadata labels
    originalTitle: "Original title",
    type: "Type",
    subject: "Subject",
    level: "Level",
    audience: "Who this is for",
    edition: "Edition",
    year: "Year",
    language: "Language of the book",
    pages: "Pages",
    pageCount: "{count} page",
    pageCountPlural: "{count} pages",
    topics: "Topics",
    author: "Author",

    languageKm: "Khmer",
    languageEn: "English",
    languageBilingual: "Khmer and English",
    languageOther: "Other",

    levelLowerSecondary: "Lower secondary",
    levelUpperSecondary: "Upper secondary",
    levelUniversity: "University",
    levelTeacher: "Teachers",
    levelGeneral: "General",

    // Sections
    aboutHeading: "About this book",
    introductionHeading: "Introduction",
    objectivesHeading: "What you will learn",
    authorNoteHeading: "A note from the author",
    acknowledgementsHeading: "Acknowledgements",
    contentsHeading: "Contents",
    samplePagesHeading: "Sample pages",
    galleryHeading: "From the book",
    editionsHeading: "Edition history",
    citationHeading: "How to cite this",
    licenceHeading: "Licence and use",
    productionHeading: "How this was made",
    relatedHeading: "Related work",
    relatedPublicationsHeading: "Other publications",

    // Contents
    chapterPages: "pages {start}–{end}",
    chapterPage: "page {start}",

    // Preview and download
    previewHeading: "Read a sample",
    openPreview: "Open the reader",
    closePreview: "Close the reader",
    previewNotAvailable: "No preview is available for this publication.",
    previewSampleOnly: "This preview shows selected sample pages only.",
    previewFirstPages: "This preview shows the first {count} pages.",
    previewFull: "This preview shows the whole book.",
    previewLoading: "Loading the reader…",
    previewFailed: "The reader could not be loaded.",
    previewFallback: "Download the PDF instead",
    previewPage: "Page {page}",
    previewPageOf: "Page {page} of {total}",
    previewNextPage: "Next page",
    previewPreviousPage: "Previous page",
    previewZoomIn: "Zoom in",
    previewZoomOut: "Zoom out",
    previewFullscreen: "Full screen",
    previewExitFullscreen: "Exit full screen",
    previewKeyboardHint:
      "Use the left and right arrow keys to turn pages, and Escape to close.",

    download: "Download",
    downloadPdf: "Download the PDF",
    downloadLabel: "Download the PDF ({size})",
    downloadEdition: "Download this edition",
    downloadNotAvailable: "This publication is not available for download.",
    downloadOnRequest: "Available on request",
    downloadOnRequestBody:
      "Get in touch and I will send you a copy.",
    downloadContactAuthor: "Contact the author for a copy",
    contactAboutThis: "Ask about this publication",
    fileMeta: "{type}, {size}",

    // Sample pages
    samplePagesBody:
      "A few pages from inside the book, chosen by the author.",
    samplePageOf: "Page {page}",
    openSamplePage: "View this page larger",

    // Editions
    currentEdition: "Current edition",
    previousEdition: "Previous edition",
    editionChangelog: "What changed",
    editionNoChangelog: "No notes were recorded for this edition.",

    // Citation
    copyCitation: "Copy citation",
    citationCopied: "Citation copied",
    copyBibtex: "Copy BibTeX",
    bibtexCopied: "BibTeX copied",
    citationNote:
      "This citation is built from the details recorded here. Check it against your style guide.",

    // Licence
    licenceAllRightsReserved: "All rights reserved",
    licencePersonalEducational: "Free for personal and educational use",
    licenceNonCommercial: "Free for non-commercial use",
    licenceCcBy: "Creative Commons Attribution 4.0",
    licenceCcBySa: "Creative Commons Attribution-ShareAlike 4.0",
    licenceCcByNd: "Creative Commons Attribution-NoDerivatives 4.0",
    licenceCcByNc: "Creative Commons Attribution-NonCommercial 4.0",
    licenceCcByNcSa: "Creative Commons Attribution-NonCommercial-ShareAlike 4.0",
    licenceCcByNcNd: "Creative Commons Attribution-NonCommercial-NoDerivatives 4.0",
    licenceCc0: "Creative Commons Zero (public domain dedication)",
    licencePublicDomain: "Public domain",
    licenceCustom: "Custom terms",
    licenceReadTerms: "Read the licence",
    copyright: "© {year} {holder}",
    redistributionAllowed: "You may share copies of this.",
    redistributionNotAllowed: "Please link to this page rather than sharing copies.",
    modificationAllowed: "You may adapt this.",
    modificationNotAllowed: "Please do not publish modified versions.",

    // LaTeX production
    latexBadge: "LaTeX",
    latexHeading: "Created with LaTeX",
    latexEngine: "Engine",
    latexDocumentClass: "Document class",
    latexBuildYear: "Typeset in",
    latexSource: "Source",
    latexSourcePrivate: "The source is not published.",
    latexSourceOnRequest: "The source is available on request.",
    latexSourcePublic: "Download the LaTeX source",
    latexSourceRepository: "View the source repository",
    latexSourceRequestCta: "Request the source",

    // Relations
    relatedJourney: "Journey story",
    relatedExperience: "Experience",
    relatedEducation: "Education",
    relatedCertificate: "Certificate",
    relatedProject: "Project",
    viewRelatedPublication: "View the related publication",
    viewRelatedPublications: "View related publications",

    // Prev / next
    previousPublication: "Previous publication",
    nextPublication: "Next publication",
    publicationNavigation: "Publication navigation",
  },

  contact: {
    title: "Contact",
    description:
      "Get in touch about teaching, tutoring, academic platforms or a product collaboration.",
    formHeading: "Send a message",
    directHeading: "Reach me directly",
    moreDetails: "Add more details",
    moreDetailsHint: "Optional — helps me reply with something useful.",
    fields: {
      name: "Your name",
      namePlaceholder: "Sok Dara",
      email: "Your email",
      emailPlaceholder: "you@example.com",
      organization: "Organisation",
      organizationPlaceholder: "School, university or company",
      subject: "Subject",
      subjectPlaceholder: "What is this about?",
      projectType: "What is this about?",
      preferredContact: "Preferred reply method",
      message: "Your message",
      messagePlaceholder: "Tell me a little about what you have in mind…",
      consent:
        "I agree that my message and email address may be stored so that Ron can reply.",
    },
    projectTypes: {
      teaching: "A teaching role",
      tutoring: "Tutoring",
      collaboration: "A collaboration",
      development: "Building something",
      speaking: "Speaking or a workshop",
      academic: "Something academic",
      other: "Something else",
    },
    preferredContact: {
      email: "Email",
      telegram: "Telegram",
      either: "Either is fine",
    },
    submit: "Send message",
    submitting: "Sending…",
    successHeading: "Message received",
    successBody:
      "Your message has been saved and I will read it. I usually reply within a few days.",
    successBodyNotified:
      "Your message has been saved and a notification was delivered. I usually reply within a few days.",
    sendAnother: "Send another message",
    errorHeading: "The message could not be sent",
    errorGeneric:
      "Something went wrong on my side. Please try again, or email me directly.",
    errorNetwork:
      "Your connection dropped before the message was sent. Please try again.",
    errorValidation: "Please check the highlighted fields and try again.",
    errorSummaryHeading: "There {count, one {is 1 problem} other {are # problems}} with your message",
    rateLimited: "Please wait {time} before sending another message.",
    rateLimitedHourly:
      "You have reached the hourly limit. Please try again in {time}.",
    validation: {
      nameRequired: "Please enter your name.",
      nameTooLong: "Your name must be 100 characters or fewer.",
      emailRequired: "Please enter your email address.",
      emailInvalid: "Please enter a valid email address, like you@example.com.",
      messageRequired: "Please enter a message.",
      messageTooShort: "Please write at least 10 characters so I can understand your request.",
      messageTooLong: "Your message must be 2,000 characters or fewer.",
      subjectTooLong: "The subject must be 150 characters or fewer.",
      organizationTooLong: "The organisation must be 150 characters or fewer.",
      consentRequired: "Please confirm this so I am able to reply.",
    },
    charactersRemaining: "{count} characters remaining",
    directEmail: "Email",
    directTelegram: "Telegram",
    responseTime: "I read every message personally, so replies take a few days.",
  },

  common: {
    readMore: "Read more",
    showMore: "Show more",
    showLess: "Show less",
    viewAll: "View all",
    back: "Back",
    close: "Close",
    cancel: "Cancel",
    retry: "Try again",
    copy: "Copy",
    copied: "Copied",
    search: "Search",
    clear: "Clear",
    yes: "Yes",
    no: "No",
    and: "and",
    featured: "Featured",
    new: "New",
    updatedOn: "Updated {date}",
    publishedOn: "Published {date}",
    pageOf: "Page {current} of {total}",
    present: "Present",
    notSpecified: "Not specified",
  },

  errors: {
    notFoundTitle: "That page does not exist",
    notFoundBody:
      "The link may be out of date, or the page may have been renamed. These links should help.",
    notFoundProjects: "Browse all projects",
    notFoundCertificates: "Browse all certificates",
    notFoundHome: "Go to the homepage",
    genericTitle: "Something went wrong",
    genericBody:
      "This page failed to load. Reloading usually fixes it. If it keeps happening, please let me know.",
    reload: "Reload the page",
    offlineTitle: "You appear to be offline",
    offlineBody: "Check your connection and try again.",
  },

  footer: {
    tagline: "Educator, mathematics student and full-stack product builder.",
    availability: "Available for education and digital-product collaboration.",
    navHeading: "Pages",
    connectHeading: "Connect",
    legalHeading: "About this site",
    builtWith: "Built with Next.js Supabase & cloudflare.",
    sourceNote: "Content is managed through a private admin dashboard.",
    copyright: "© {year} Ron Raksmey",
    backToTop: "Back to top",
  },

  theme: {
    light: "Light",
    dark: "Dark",
    system: "System",
  },
} as const;

/**
 * Recursively relaxes the literal types from `as const` to `string`, so another
 * locale must supply the same *keys* without having to match English's exact
 * *values*. A missing or misspelled key in `km.ts` is a compile error.
 */
type Translated<T> = {
  [K in keyof T]: T[K] extends string ? string : Translated<T[K]>;
};

export type Dictionary = Translated<typeof en>;

