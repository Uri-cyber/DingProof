/* DingProof — client-side rental car inspection report.
   No network calls, no storage, nothing leaves the device.
   (The small window.claude check below is dormant everywhere except the
   claude.ai preview host, where pages may not start downloads directly.) */
(function () {
  'use strict';

  /* ---------------------------------------------------------------
     Config
  --------------------------------------------------------------- */

  var MAX_EDGE = 1200;      // longest side of a stored photo, in pixels
  var JPEG_QUALITY = 0.72;

  // Canonical names stay in English: the PDF is always produced in English
  // so a rental company anywhere can read it. The UI translates on top.
  var SHOTS = [
    { key: 'front',       name: 'Front' },
    { key: 'front_right', name: 'Front right corner' },
    { key: 'right',       name: 'Right side' },
    { key: 'rear_right',  name: 'Rear right corner' },
    { key: 'rear',        name: 'Rear' },
    { key: 'rear_left',   name: 'Rear left corner' },
    { key: 'left',        name: 'Left side' },
    { key: 'extras',      name: 'Roof, glass, inside, odometer' }
  ];

  var SHOT_HOW_EN = [
    'Stand in front of the car. Fit the whole front in the photo.',
    'Step to the right corner. Show the bumper and the wing together.',
    'Whole right side, both wheels in the picture.',
    'Show the rear bumper and the right wing.',
    'Stand behind the car. Include the plate and both lights.',
    'Show the rear bumper and the left wing.',
    'Whole left side, both wheels in the picture.',
    'One photo of the roof and windscreen, plus the dashboard showing the kilometres.'
  ];

  var DAMAGE_TYPES = [
    'Scratch', 'Dent', 'Wheel scuff', 'Chip or crack',
    'Missing part', 'Stain or tear', 'Other'
  ];

  /* ---------------------------------------------------------------
     Translations. Keys shared by all five languages.
  --------------------------------------------------------------- */

  var STR = {};

  STR.en = {
    skip: 'Skip to content',
    tagline: 'Two minutes now. Evidence forever.',
    tab1: 'Car', tab2: 'Photos', tab3: 'Damage', tab4: 'Report',
    s1_title: 'Step 1 of 4 — Your car',
    s1_lede: 'Fill this in before you drive away. It takes about 30 seconds.',
    company_l: 'Rental company',
    plate_l: 'Licence plate', plate_req: 'needed',
    plate_hint: 'You will find it on the key tag or the car itself.',
    model_l: 'Make and model',
    odo_l: 'Odometer (km or miles)',
    odo_hint: 'Photo 8 shows it too, so an exact number here is optional.',
    fuel_l: 'Fuel level', fuel_full: 'Full', fuel_empty: 'Empty',
    fuel_hint: 'Electric car? Photo 8 of the dashboard shows the charge.',
    phase_l: 'When are you checking the car?',
    pickup: 'Pickup', pickup_sub: 'Before I drive away',
    return: 'Return', return_sub: 'Giving the car back',
    cmp_t: 'Compare with your pickup report',
    cmp_hint: 'Load the pickup file you saved when you collected the car. Old damage shows in grey, so only new damage is in question.',
    cmp_btn: 'Load pickup file',
    cmp_loaded: 'Loaded: {n} marks from the pickup of {date}',
    cmp_bad: 'That file is not a DingProof pickup file.',
    geo_t: 'Add the location?',
    geo_hint: 'This proves where the car was. It is asked once and stays on your phone.',
    geo_btn: 'Use my location', geo_none: 'Location not recorded',
    geo_saved: 'Location saved', geo_na: 'Not available', geo_asking: 'Asking…',
    next_photos: 'Next: take photos',
    s2_title: 'Step 2 of 4 — 8 photos',
    s2_lede: 'Walk around the car in one direction. Stand about two steps back. Tap each box in order.',
    photos_taken: 'photos taken',
    s1n: 'Front', s2n: 'Front right corner', s3n: 'Right side', s4n: 'Rear right corner',
    s5n: 'Rear', s6n: 'Rear left corner', s7n: 'Left side', s8n: 'Roof, glass, inside, odometer',
    s1h: SHOT_HOW_EN[0], s2h: SHOT_HOW_EN[1], s3h: SHOT_HOW_EN[2], s4h: SHOT_HOW_EN[3],
    s5h: SHOT_HOW_EN[4], s6h: SHOT_HOW_EN[5], s7h: SHOT_HOW_EN[6], s8h: SHOT_HOW_EN[7],
    take: 'Take photo', retake: 'Retake', working: 'Working…', tryagain: 'Try again',
    read_err: 'That photo could not be read. Please take it again.',
    ph_dark: 'This photo looks dark. Retake it if you can.',
    ph_blur: 'This photo looks blurry. Retake it if you can.',
    vid_t: 'Walk-around video (optional)',
    vid_hint: '30 seconds around the car in one take. Video is even harder to argue with than photos. It is saved as its own file, next to the PDF.',
    vid_btn: 'Record video', vid_re: 'Record again', vid_ok: 'Recorded · {size}', vid_rm: 'Remove',
    back: 'Back', next_damage: 'Next: mark damage',
    s3_title: 'Step 3 of 4 — Mark the damage',
    s3_lede: 'Tap the car where you see a scratch, dent or crack. Add one mark for each problem. If the car is perfect, skip this step.',
    svg_hint: 'Tap the car above to add a mark.',
    pk_legend: 'Grey pins P1–P{n}: damage already recorded at pickup.',
    no_marks: 'No damage marked yet.', remove: 'Remove',
    add_cu: 'Add close-up photo', replace: 'Replace',
    dlg_t: 'What did you find here?',
    dt0: 'Scratch', dt1: 'Dent', dt2: 'Wheel scuff', dt3: 'Chip or crack',
    dt4: 'Missing part', dt5: 'Stain or tear', dt6: 'Other',
    note_l: 'Note (optional)', note_ph: 'e.g. deep scratch, about 10 cm',
    note_latin: 'Tip: a note in English shows best in the PDF.',
    cu_l: 'Close-up photo (optional)',
    cu_hint: 'A photo of this exact spot. It goes in the report on its own page.',
    cu_take: 'Take close-up', cu_re: 'Retake close-up', cu_rm: 'Remove photo',
    cancel: 'Cancel', addmark: 'Add mark',
    next_report: 'Next: get my report',
    s4_title: 'Step 4 of 4 — Your report',
    s4_lede: 'Check the summary, then download the PDF. Email it to yourself so you always have a copy.',
    sum_phase: 'Inspection', sum_company: 'Rental company', sum_plate: 'Licence plate',
    sum_model: 'Make and model', sum_odo: 'Odometer', sum_fuel: 'Fuel level',
    sum_photos: 'Photos taken', sum_marks: 'Damage marks', sum_cu: 'Close-up photos',
    sum_video: 'Walk-around video', sum_cmp: 'Pickup file', sum_loc: 'Location',
    notgiven: 'Not given', notrec: 'Not recorded', yes: 'Yes', none_w: 'None',
    n_of_n: '{a} of {b}',
    cmp_sum: '{n} old marks, pickup of {date}',
    warn0_t: 'You have not taken any photos of the car.',
    warn0_x: 'Your report will show the damage you marked, but not the car itself. Photos of the whole car are the strongest evidence you can have. It takes about a minute.',
    warn0_b: 'Take the 8 car photos',
    warnN_t1: '1 of the 8 car photos is missing.',
    warnN_t: '{n} of the 8 car photos are missing.',
    warnN_x: 'You have {a}. The missing ones will not be in the report. Go back and take them if you can.',
    warnN_b: 'Take the missing photos',
    dl_btn: 'Download PDF report',
    share_btn: 'Share the PDF', vid_dl: 'Download video',
    save_pickup: 'Save pickup file',
    save_pickup_hint: 'The pickup file is a small extra file. Load it at return and only new damage is in question.',
    dispute_btn: 'Copy dispute email text',
    copied: 'Copied. Paste it into your email. The text is in English on purpose.',
    copy_fail: 'Could not copy on this device.',
    st_build: 'Building your PDF…',
    st_saved: 'Saved as {name}',
    st_savefail: 'The file could not be saved on this device.',
    st_nolib: 'The PDF tool did not load. Check your connection and reload the page.',
    st_cancel: 'Download cancelled. Tap the button to try again.',
    st_big: 'This file is too big to save here. A shorter video will fit.',
    st_wait: 'Confirm the download when your browser asks…',
    disc_t: 'Please read.',
    disc_x: 'This report is your own documentation of the car. It is not an official document and it does not automatically bind the rental company or anyone else. It is evidence you made yourself, with dates and photos, to support your side if there is a dispute.',
    priv: 'Everything stays on your phone. Your photos are never uploaded and nothing is saved after you close this page.',
    foot: 'DingProof is free and runs entirely in your browser. No accounts, no tracking, no uploads.',
    reset_btn: 'Start a new car',
    reset_confirm: 'This deletes your photos and marks. Continue?',
    pdf_en_note: 'The PDF itself is written in English, so rental companies anywhere can read it.',
    install_t: 'Add DingProof to your home screen so it opens instantly, even with no signal.',
    install_btn: 'Add to home screen'
  };

  STR.he = {
    skip: 'דלג לתוכן',
    tagline: 'שתי דקות עכשיו. ראיות לתמיד.',
    tab1: 'רכב', tab2: 'תמונות', tab3: 'נזקים', tab4: 'דו"ח',
    s1_title: 'שלב 1 מתוך 4 — הרכב שלך',
    s1_lede: 'מלאו את זה לפני שאתם נוסעים. לוקח בערך 30 שניות.',
    company_l: 'חברת ההשכרה',
    plate_l: 'מספר רישוי', plate_req: 'חובה',
    plate_hint: 'מופיע על המחזיק של המפתח או על הרכב עצמו.',
    model_l: 'יצרן ודגם',
    odo_l: 'מד אוץ (ק"מ או מייל)',
    odo_hint: 'מופיע גם בתמונה 8, אז מספר מדויק כאן הוא רשות.',
    fuel_l: 'מפלס דלק', fuel_full: 'מלא', fuel_empty: 'ריק',
    fuel_hint: 'רכב חשמלי? תמונה 8 של הלוח מציגה את הטעינה.',
    phase_l: 'מתי אתם בודקים את הרכב?',
    pickup: 'איסוף', pickup_sub: 'לפני שאני נוסע',
    return: 'החזרה', return_sub: 'מחזירים את הרכב',
    cmp_t: 'השוואה לדו"ח האיסוף',
    cmp_hint: 'טענו את קובץ האיסוף ששמרתם כשלקחתם את הרכב. נזקים ישנים יוצגו באפור, כך שרק נזק חדש עומד לדיון.',
    cmp_btn: 'טען קובץ איסוף',
    cmp_loaded: 'נטען: {n} סימונים מאיסוף בתאריך {date}',
    cmp_bad: 'הקובץ הזה אינו קובץ איסוף של DingProof.',
    geo_t: 'להוסיף מיקום?',
    geo_hint: 'זה מוכיח איפה הרכב היה. נשאל פעם אחת ונשאר בטלפון שלכם.',
    geo_btn: 'השתמש במיקום שלי', geo_none: 'מיקום לא נשמר',
    geo_saved: 'המיקום נשמר', geo_na: 'לא זמין', geo_asking: 'מבקש…',
    next_photos: 'המשך: צילום תמונות',
    s2_title: 'שלב 2 מתוך 4 — 8 תמונות',
    s2_lede: 'הקיפו את הרכב בכיוון אחד. עמדו כשני צעדים אחורה. לחצו על כל תיבה לפי הסדר.',
    photos_taken: 'תמונות צולמו',
    s1n: 'חזית', s2n: 'פינה קדמית ימנית', s3n: 'צד ימין', s4n: 'פינה אחורית ימנית',
    s5n: 'אחור', s6n: 'פינה אחורית שמאלית', s7n: 'צד שמאל', s8n: 'גג, שמשות, פנים ומד אוץ',
    s1h: 'עמדו מול חזית הרכב. כל החזית בתמונה.',
    s2h: 'גשו לפינה הימנית. הפגוש והכנף יחד.',
    s3h: 'כל צד ימין, שני הגלגלים בתמונה.',
    s4h: 'הפגוש האחורי והכנף הימני.',
    s5h: 'עמדו מאחורי הרכב. כולל הלוחית ושני הפנסים.',
    s6h: 'הפגוש האחורי והכנף השמאלי.',
    s7h: 'כל צד שמאל, שני הגלגלים בתמונה.',
    s8h: 'תמונה אחת של הגג והשמשה, ועוד אחת של הלוח עם הקילומטראז׳.',
    take: 'צלם', retake: 'צלם שוב', working: 'רגע…', tryagain: 'נסו שוב',
    read_err: 'לא הצלחנו לקרוא את התמונה. צלמו שוב.',
    ph_dark: 'התמונה נראית חשוכה. כדאי לצלם שוב.',
    ph_blur: 'התמונה נראית מטושטשת. כדאי לצלם שוב.',
    vid_t: 'סרטון הקפה (רשות)',
    vid_hint: '30 שניות מסביב לרכב בצילום אחד. עם וידאו קשה עוד יותר להתווכח. נשמר כקובץ נפרד, לצד ה-PDF.',
    vid_btn: 'צלם סרטון', vid_re: 'צלם שוב', vid_ok: 'הוקלט · {size}', vid_rm: 'הסר',
    back: 'חזרה', next_damage: 'המשך: סימון נזקים',
    s3_title: 'שלב 3 מתוך 4 — סמנו את הנזקים',
    s3_lede: 'לחצו על הרכב במקום שבו יש שריטה, מעיכה או סדק. סימון אחד לכל בעיה. אם הרכב תקין, דלגו על השלב.',
    svg_hint: 'לחצו על הרכב כדי להוסיף סימון.',
    pk_legend: 'סיכות אפורות P1–P{n}: נזקים שכבר תועדו באיסוף.',
    no_marks: 'טרם סומנו נזקים.', remove: 'הסר',
    add_cu: 'הוסף תקריב', replace: 'החלף',
    dlg_t: 'מה מצאתם כאן?',
    dt0: 'שריטה', dt1: 'מעיכה', dt2: 'שפשוף חישוק', dt3: 'שבב או סדק',
    dt4: 'חלק חסר', dt5: 'כתם או קרע', dt6: 'אחר',
    note_l: 'הערה (רשות)', note_ph: 'למשל: שריטה עמוקה, כ-10 ס"מ',
    note_latin: 'טיפ: הערה באנגלית תוצג הכי טוב ב-PDF.',
    cu_l: 'תקריב (רשות)',
    cu_hint: 'תמונה של הנקודה המדויקת. תופיע בדו"ח בעמוד משלה.',
    cu_take: 'צלם תקריב', cu_re: 'צלם שוב', cu_rm: 'הסר תמונה',
    cancel: 'ביטול', addmark: 'הוסף סימון',
    next_report: 'המשך: הדו"ח שלי',
    s4_title: 'שלב 4 מתוך 4 — הדו"ח שלכם',
    s4_lede: 'בדקו את הסיכום והורידו את ה-PDF. שלחו לעצמכם במייל כדי שתמיד יהיה לכם עותק.',
    sum_phase: 'סוג בדיקה', sum_company: 'חברת השכרה', sum_plate: 'מספר רישוי',
    sum_model: 'יצרן ודגם', sum_odo: 'מד אוץ', sum_fuel: 'דלק',
    sum_photos: 'תמונות', sum_marks: 'סימוני נזק', sum_cu: 'תקריבים',
    sum_video: 'סרטון הקפה', sum_cmp: 'קובץ איסוף', sum_loc: 'מיקום',
    notgiven: 'לא הוזן', notrec: 'לא נשמר', yes: 'כן', none_w: 'אין',
    n_of_n: '{a} מתוך {b}',
    cmp_sum: '{n} סימונים ישנים, איסוף מ-{date}',
    warn0_t: 'לא צילמתם אף תמונה של הרכב.',
    warn0_x: 'הדו"ח יציג את הנזקים שסימנתם, אבל לא את הרכב עצמו. תמונות של כל הרכב הן הראיה החזקה ביותר. לוקח כדקה.',
    warn0_b: 'צלמו את 8 התמונות',
    warnN_t1: 'חסרה תמונה אחת מתוך 8.',
    warnN_t: 'חסרות {n} תמונות מתוך 8.',
    warnN_x: 'יש לכם {a}. החסרות לא יופיעו בדו"ח. חזרו וצלמו אותן אם אפשר.',
    warnN_b: 'צלמו את החסרות',
    dl_btn: 'הורדת דו"ח PDF',
    share_btn: 'שתף את ה-PDF', vid_dl: 'הורד סרטון',
    save_pickup: 'שמור קובץ איסוף',
    save_pickup_hint: 'קובץ האיסוף הוא קובץ קטן נוסף. טענו אותו בהחזרה ורק נזק חדש יעמוד לדיון.',
    dispute_btn: 'העתק נוסח מייל לערעור',
    copied: 'הועתק. הדביקו במייל. הנוסח באנגלית בכוונה.',
    copy_fail: 'לא ניתן להעתיק במכשיר הזה.',
    st_build: 'בונה את ה-PDF…',
    st_saved: 'נשמר בשם {name}',
    st_savefail: 'לא ניתן לשמור את הקובץ במכשיר הזה.',
    st_nolib: 'כלי ה-PDF לא נטען. בדקו חיבור ורעננו את הדף.',
    st_cancel: 'ההורדה בוטלה. לחצו שוב כדי לנסות.',
    st_big: 'הקובץ גדול מדי לשמירה כאן. סרטון קצר יותר יתאים.',
    st_wait: 'אשרו את ההורדה כשהדפדפן ישאל…',
    disc_t: 'חשוב לקרוא.',
    disc_x: 'הדו"ח הזה הוא התיעוד האישי שלכם. הוא אינו מסמך רשמי ואינו מחייב אוטומטית את חברת ההשכרה. אלו ראיות שיצרתם בעצמכם, עם תאריכים ותמונות, לתמוך בצד שלכם אם תהיה מחלוקת.',
    priv: 'הכל נשאר בטלפון שלכם. התמונות אף פעם לא עולות לרשת ושום דבר לא נשמר אחרי סגירת הדף.',
    foot: 'DingProof חינם ופועל כולו בדפדפן. בלי חשבונות, בלי מעקב, בלי העלאות.',
    reset_btn: 'רכב חדש',
    reset_confirm: 'זה מוחק את התמונות והסימונים. להמשיך?',
    pdf_en_note: 'ה-PDF עצמו נכתב באנגלית, כדי שכל חברת השכרה בעולם תוכל לקרוא אותו.',
    install_t: 'הוסיפו את DingProof למסך הבית כדי שייפתח מיד, גם בלי קליטה.',
    install_btn: 'הוספה למסך הבית'
  };

  STR.de = {
    skip: 'Zum Inhalt springen',
    tagline: 'Zwei Minuten jetzt. Beweise für immer.',
    tab1: 'Auto', tab2: 'Fotos', tab3: 'Schäden', tab4: 'Bericht',
    s1_title: 'Schritt 1 von 4 — Ihr Auto',
    s1_lede: 'Füllen Sie dies vor der Abfahrt aus. Dauert etwa 30 Sekunden.',
    company_l: 'Mietwagenfirma',
    plate_l: 'Kennzeichen', plate_req: 'erforderlich',
    plate_hint: 'Steht auf dem Schlüsselanhänger oder am Auto selbst.',
    model_l: 'Marke und Modell',
    odo_l: 'Kilometerstand',
    odo_hint: 'Auch auf Foto 8 zu sehen, eine genaue Zahl hier ist optional.',
    fuel_l: 'Tankstand', fuel_full: 'Voll', fuel_empty: 'Leer',
    fuel_hint: 'Elektroauto? Foto 8 vom Display zeigt den Ladestand.',
    phase_l: 'Wann prüfen Sie das Auto?',
    pickup: 'Abholung', pickup_sub: 'Vor der Abfahrt',
    return: 'Rückgabe', return_sub: 'Auto wird zurückgegeben',
    cmp_t: 'Mit dem Abholbericht vergleichen',
    cmp_hint: 'Laden Sie die bei der Abholung gespeicherte Datei. Alte Schäden werden grau angezeigt, nur neue Schäden zählen.',
    cmp_btn: 'Abholdatei laden',
    cmp_loaded: 'Geladen: {n} Markierungen von der Abholung am {date}',
    cmp_bad: 'Das ist keine DingProof-Abholdatei.',
    geo_t: 'Standort hinzufügen?',
    geo_hint: 'Das belegt, wo das Auto war. Wird einmal gefragt und bleibt auf Ihrem Telefon.',
    geo_btn: 'Meinen Standort nutzen', geo_none: 'Standort nicht erfasst',
    geo_saved: 'Standort gespeichert', geo_na: 'Nicht verfügbar', geo_asking: 'Wird angefragt…',
    next_photos: 'Weiter: Fotos aufnehmen',
    s2_title: 'Schritt 2 von 4 — 8 Fotos',
    s2_lede: 'Umrunden Sie das Auto in eine Richtung. Etwa zwei Schritte Abstand. Tippen Sie die Felder der Reihe nach an.',
    photos_taken: 'Fotos aufgenommen',
    s1n: 'Front', s2n: 'Vordere rechte Ecke', s3n: 'Rechte Seite', s4n: 'Hintere rechte Ecke',
    s5n: 'Heck', s6n: 'Hintere linke Ecke', s7n: 'Linke Seite', s8n: 'Dach, Scheiben, Innenraum, Tacho',
    s1h: 'Vor das Auto stellen. Die ganze Front aufs Foto.',
    s2h: 'Zur rechten Ecke gehen. Stoßstange und Kotflügel zusammen zeigen.',
    s3h: 'Ganze rechte Seite, beide Räder im Bild.',
    s4h: 'Hintere Stoßstange und rechten Kotflügel zeigen.',
    s5h: 'Hinter das Auto stellen. Kennzeichen und beide Leuchten einschließen.',
    s6h: 'Hintere Stoßstange und linken Kotflügel zeigen.',
    s7h: 'Ganze linke Seite, beide Räder im Bild.',
    s8h: 'Ein Foto von Dach und Windschutzscheibe, plus das Armaturenbrett mit dem Kilometerstand.',
    take: 'Foto aufnehmen', retake: 'Erneut aufnehmen', working: 'Wird verarbeitet…', tryagain: 'Erneut versuchen',
    read_err: 'Das Foto konnte nicht gelesen werden. Bitte erneut aufnehmen.',
    ph_dark: 'Dieses Foto sieht dunkel aus. Wenn möglich, erneut aufnehmen.',
    ph_blur: 'Dieses Foto sieht unscharf aus. Wenn möglich, erneut aufnehmen.',
    vid_t: 'Rundgang-Video (optional)',
    vid_hint: '30 Sekunden in einer Aufnahme ums Auto. Video ist noch schwerer zu bestreiten als Fotos. Wird als eigene Datei neben dem PDF gespeichert.',
    vid_btn: 'Video aufnehmen', vid_re: 'Erneut aufnehmen', vid_ok: 'Aufgenommen · {size}', vid_rm: 'Entfernen',
    back: 'Zurück', next_damage: 'Weiter: Schäden markieren',
    s3_title: 'Schritt 3 von 4 — Schäden markieren',
    s3_lede: 'Tippen Sie auf das Auto, wo ein Kratzer, eine Delle oder ein Riss ist. Für jedes Problem eine Markierung. Wenn das Auto einwandfrei ist, überspringen Sie diesen Schritt.',
    svg_hint: 'Auf das Auto tippen, um eine Markierung hinzuzufügen.',
    pk_legend: 'Graue Stecknadeln P1–P{n}: bei der Abholung bereits erfasste Schäden.',
    no_marks: 'Noch keine Schäden markiert.', remove: 'Entfernen',
    add_cu: 'Nahaufnahme hinzufügen', replace: 'Ersetzen',
    dlg_t: 'Was haben Sie hier gefunden?',
    dt0: 'Kratzer', dt1: 'Delle', dt2: 'Felgenschaden', dt3: 'Absplitterung oder Riss',
    dt4: 'Fehlendes Teil', dt5: 'Fleck oder Riss', dt6: 'Sonstiges',
    note_l: 'Notiz (optional)', note_ph: 'z. B. tiefer Kratzer, ca. 10 cm',
    note_latin: 'Tipp: Eine Notiz auf Englisch wird im PDF am besten dargestellt.',
    cu_l: 'Nahaufnahme (optional)',
    cu_hint: 'Ein Foto genau dieser Stelle. Erscheint im Bericht auf einer eigenen Seite.',
    cu_take: 'Nahaufnahme machen', cu_re: 'Erneut aufnehmen', cu_rm: 'Foto entfernen',
    cancel: 'Abbrechen', addmark: 'Markierung hinzufügen',
    next_report: 'Weiter: Mein Bericht',
    s4_title: 'Schritt 4 von 4 — Ihr Bericht',
    s4_lede: 'Zusammenfassung prüfen, dann PDF herunterladen. Senden Sie es sich per E-Mail, damit Sie immer eine Kopie haben.',
    sum_phase: 'Prüfung', sum_company: 'Mietwagenfirma', sum_plate: 'Kennzeichen',
    sum_model: 'Marke und Modell', sum_odo: 'Kilometerstand', sum_fuel: 'Tankstand',
    sum_photos: 'Aufgenommene Fotos', sum_marks: 'Schadensmarkierungen', sum_cu: 'Nahaufnahmen',
    sum_video: 'Rundgang-Video', sum_cmp: 'Abholdatei', sum_loc: 'Standort',
    notgiven: 'Nicht angegeben', notrec: 'Nicht erfasst', yes: 'Ja', none_w: 'Keine',
    n_of_n: '{a} von {b}',
    cmp_sum: '{n} alte Markierungen, Abholung am {date}',
    warn0_t: 'Sie haben noch keine Fotos vom Auto aufgenommen.',
    warn0_x: 'Ihr Bericht zeigt die markierten Schäden, aber nicht das Auto selbst. Fotos vom ganzen Auto sind der stärkste Beweis. Dauert etwa eine Minute.',
    warn0_b: 'Die 8 Fotos aufnehmen',
    warnN_t1: '1 der 8 Fotos fehlt.',
    warnN_t: '{n} der 8 Fotos fehlen.',
    warnN_x: 'Sie haben {a}. Die fehlenden erscheinen nicht im Bericht. Gehen Sie zurück, wenn möglich.',
    warnN_b: 'Fehlende Fotos aufnehmen',
    dl_btn: 'PDF-Bericht herunterladen',
    share_btn: 'PDF teilen', vid_dl: 'Video herunterladen',
    save_pickup: 'Abholdatei speichern',
    save_pickup_hint: 'Die Abholdatei ist eine kleine Zusatzdatei. Bei der Rückgabe laden, dann zählt nur neuer Schaden.',
    dispute_btn: 'E-Mail-Text kopieren',
    copied: 'Kopiert. In Ihre E-Mail einfügen. Der Text ist bewusst auf Englisch.',
    copy_fail: 'Kopieren auf diesem Gerät nicht möglich.',
    st_build: 'PDF wird erstellt…',
    st_saved: 'Gespeichert als {name}',
    st_savefail: 'Die Datei konnte auf diesem Gerät nicht gespeichert werden.',
    st_nolib: 'Das PDF-Werkzeug wurde nicht geladen. Verbindung prüfen und Seite neu laden.',
    st_cancel: 'Download abgebrochen. Zum erneuten Versuch tippen.',
    st_big: 'Diese Datei ist zu groß zum Speichern. Ein kürzeres Video passt.',
    st_wait: 'Download im Browser bestätigen…',
    disc_t: 'Bitte lesen.',
    disc_x: 'Dieser Bericht ist Ihre eigene Dokumentation des Autos. Er ist kein offizielles Dokument und bindet die Mietwagenfirma oder andere nicht automatisch. Es ist ein von Ihnen selbst erstellter Beweis mit Daten und Fotos, der Ihre Seite bei einem Streitfall unterstützt.',
    priv: 'Alles bleibt auf Ihrem Telefon. Ihre Fotos werden nie hochgeladen, und nichts wird gespeichert, nachdem Sie diese Seite schließen.',
    foot: 'DingProof ist kostenlos und läuft vollständig im Browser. Keine Konten, kein Tracking, keine Uploads.',
    reset_btn: 'Neues Auto',
    reset_confirm: 'Dadurch werden Ihre Fotos und Markierungen gelöscht. Fortfahren?',
    pdf_en_note: 'Das PDF selbst ist auf Englisch verfasst, damit Mietwagenfirmen überall es lesen können.',
    install_t: 'Fügen Sie DingProof zum Homescreen hinzu, damit es sofort startet, auch ohne Empfang.',
    install_btn: 'Zum Homescreen hinzufügen'
  };

  STR.fr = {
    skip: 'Aller au contenu',
    tagline: 'Deux minutes maintenant. Des preuves pour toujours.',
    tab1: 'Voiture', tab2: 'Photos', tab3: 'Dommages', tab4: 'Rapport',
    s1_title: 'Étape 1 sur 4 — Votre voiture',
    s1_lede: 'Remplissez ceci avant de partir. Environ 30 secondes.',
    company_l: 'Société de location',
    plate_l: 'Plaque d\'immatriculation', plate_req: 'requis',
    plate_hint: 'Elle se trouve sur le porte-clés ou sur la voiture.',
    model_l: 'Marque et modèle',
    odo_l: 'Kilométrage',
    odo_hint: 'Visible aussi sur la photo 8, un chiffre exact ici est facultatif.',
    fuel_l: 'Niveau de carburant', fuel_full: 'Plein', fuel_empty: 'Vide',
    fuel_hint: 'Voiture électrique ? La photo 8 du tableau de bord montre la charge.',
    phase_l: 'Quand vérifiez-vous la voiture ?',
    pickup: 'Prise en charge', pickup_sub: 'Avant de partir',
    return: 'Retour', return_sub: 'Restitution de la voiture',
    cmp_t: 'Comparer avec le rapport de prise en charge',
    cmp_hint: 'Chargez le fichier enregistré lors de la prise en charge. Les anciens dommages apparaissent en gris, seuls les nouveaux comptent.',
    cmp_btn: 'Charger le fichier',
    cmp_loaded: 'Chargé : {n} marques de la prise en charge du {date}',
    cmp_bad: 'Ce fichier n\'est pas un fichier de prise en charge DingProof.',
    geo_t: 'Ajouter la position ?',
    geo_hint: 'Cela prouve où était la voiture. Demandé une seule fois, reste sur votre téléphone.',
    geo_btn: 'Utiliser ma position', geo_none: 'Position non enregistrée',
    geo_saved: 'Position enregistrée', geo_na: 'Non disponible', geo_asking: 'Demande en cours…',
    next_photos: 'Suivant : prendre les photos',
    s2_title: 'Étape 2 sur 4 — 8 photos',
    s2_lede: 'Faites le tour de la voiture dans un sens. Reculez d\'environ deux pas. Touchez chaque case dans l\'ordre.',
    photos_taken: 'photos prises',
    s1n: 'Avant', s2n: 'Coin avant droit', s3n: 'Côté droit', s4n: 'Coin arrière droit',
    s5n: 'Arrière', s6n: 'Coin arrière gauche', s7n: 'Côté gauche', s8n: 'Toit, vitres, intérieur, compteur',
    s1h: 'Placez-vous devant la voiture. Tout l\'avant dans la photo.',
    s2h: 'Allez au coin droit. Montrez le pare-chocs et l\'aile ensemble.',
    s3h: 'Tout le côté droit, les deux roues dans l\'image.',
    s4h: 'Montrez le pare-chocs arrière et l\'aile droite.',
    s5h: 'Placez-vous derrière la voiture. Incluez la plaque et les deux feux.',
    s6h: 'Montrez le pare-chocs arrière et l\'aile gauche.',
    s7h: 'Tout le côté gauche, les deux roues dans l\'image.',
    s8h: 'Une photo du toit et du pare-brise, plus le tableau de bord montrant le kilométrage.',
    take: 'Prendre la photo', retake: 'Reprendre', working: 'Traitement…', tryagain: 'Réessayer',
    read_err: 'Cette photo n\'a pas pu être lue. Reprenez-la.',
    ph_dark: 'Cette photo semble sombre. Reprenez-la si possible.',
    ph_blur: 'Cette photo semble floue. Reprenez-la si possible.',
    vid_t: 'Vidéo du tour (facultatif)',
    vid_hint: '30 secondes autour de la voiture en une seule prise. Une vidéo est encore plus difficile à contester que des photos. Enregistrée comme fichier séparé, à côté du PDF.',
    vid_btn: 'Filmer', vid_re: 'Refilmer', vid_ok: 'Enregistrée · {size}', vid_rm: 'Supprimer',
    back: 'Retour', next_damage: 'Suivant : marquer les dommages',
    s3_title: 'Étape 3 sur 4 — Marquer les dommages',
    s3_lede: 'Touchez la voiture là où il y a une rayure, une bosse ou une fissure. Une marque par problème. Si la voiture est impeccable, passez cette étape.',
    svg_hint: 'Touchez la voiture ci-dessus pour ajouter une marque.',
    pk_legend: 'Épingles grises P1–P{n} : dommages déjà notés à la prise en charge.',
    no_marks: 'Aucun dommage marqué pour l\'instant.', remove: 'Supprimer',
    add_cu: 'Ajouter un gros plan', replace: 'Remplacer',
    dlg_t: 'Qu\'avez-vous trouvé ici ?',
    dt0: 'Rayure', dt1: 'Bosse', dt2: 'Jante frottée', dt3: 'Éclat ou fissure',
    dt4: 'Pièce manquante', dt5: 'Tache ou déchirure', dt6: 'Autre',
    note_l: 'Note (facultatif)', note_ph: 'ex. rayure profonde, environ 10 cm',
    note_latin: 'Astuce : une note en anglais s\'affiche mieux dans le PDF.',
    cu_l: 'Gros plan (facultatif)',
    cu_hint: 'Une photo de cet endroit précis. Elle apparaît dans le rapport sur sa propre page.',
    cu_take: 'Prendre un gros plan', cu_re: 'Reprendre', cu_rm: 'Supprimer la photo',
    cancel: 'Annuler', addmark: 'Ajouter la marque',
    next_report: 'Suivant : mon rapport',
    s4_title: 'Étape 4 sur 4 — Votre rapport',
    s4_lede: 'Vérifiez le résumé, puis téléchargez le PDF. Envoyez-le-vous par e-mail pour toujours en avoir une copie.',
    sum_phase: 'Inspection', sum_company: 'Société de location', sum_plate: 'Plaque',
    sum_model: 'Marque et modèle', sum_odo: 'Kilométrage', sum_fuel: 'Carburant',
    sum_photos: 'Photos prises', sum_marks: 'Marques de dommage', sum_cu: 'Gros plans',
    sum_video: 'Vidéo du tour', sum_cmp: 'Fichier de prise en charge', sum_loc: 'Position',
    notgiven: 'Non indiqué', notrec: 'Non enregistrée', yes: 'Oui', none_w: 'Aucun',
    n_of_n: '{a} sur {b}',
    cmp_sum: '{n} anciennes marques, prise en charge du {date}',
    warn0_t: 'Vous n\'avez pris aucune photo de la voiture.',
    warn0_x: 'Votre rapport montrera les dommages marqués, mais pas la voiture elle-même. Des photos de toute la voiture sont la preuve la plus forte. Cela prend environ une minute.',
    warn0_b: 'Prendre les 8 photos',
    warnN_t1: '1 des 8 photos manque.',
    warnN_t: '{n} des 8 photos manquent.',
    warnN_x: 'Vous en avez {a}. Celles qui manquent ne seront pas dans le rapport. Retournez les prendre si possible.',
    warnN_b: 'Prendre les photos manquantes',
    dl_btn: 'Télécharger le rapport PDF',
    share_btn: 'Partager le PDF', vid_dl: 'Télécharger la vidéo',
    save_pickup: 'Enregistrer le fichier de prise en charge',
    save_pickup_hint: 'Le fichier de prise en charge est un petit fichier supplémentaire. Chargez-le au retour, seuls les nouveaux dommages compteront.',
    dispute_btn: 'Copier le texte de contestation',
    copied: 'Copié. Collez-le dans votre e-mail. Le texte est volontairement en anglais.',
    copy_fail: 'Impossible de copier sur cet appareil.',
    st_build: 'Création du PDF…',
    st_saved: 'Enregistré sous {name}',
    st_savefail: 'Le fichier n\'a pas pu être enregistré sur cet appareil.',
    st_nolib: 'L\'outil PDF ne s\'est pas chargé. Vérifiez la connexion et rechargez la page.',
    st_cancel: 'Téléchargement annulé. Touchez à nouveau pour réessayer.',
    st_big: 'Ce fichier est trop volumineux pour être enregistré ici. Une vidéo plus courte conviendra.',
    st_wait: 'Confirmez le téléchargement demandé par le navigateur…',
    disc_t: 'À lire.',
    disc_x: 'Ce rapport est votre propre documentation de la voiture. Ce n\'est pas un document officiel et il n\'engage pas automatiquement la société de location ou qui que ce soit d\'autre. C\'est une preuve que vous avez créée vous-même, avec dates et photos, pour appuyer votre position en cas de litige.',
    priv: 'Tout reste sur votre téléphone. Vos photos ne sont jamais téléchargées et rien n\'est conservé après la fermeture de cette page.',
    foot: 'DingProof est gratuit et fonctionne entièrement dans le navigateur. Pas de compte, pas de suivi, pas de téléversement.',
    reset_btn: 'Nouvelle voiture',
    reset_confirm: 'Cela supprime vos photos et vos marques. Continuer ?',
    pdf_en_note: 'Le PDF lui-même est rédigé en anglais, afin que les sociétés de location partout puissent le lire.',
    install_t: 'Ajoutez DingProof à votre écran d\'accueil pour qu\'il s\'ouvre instantanément, même sans réseau.',
    install_btn: 'Ajouter à l\'écran d\'accueil'
  };

  STR.es = {
    skip: 'Ir al contenido',
    tagline: 'Dos minutos ahora. Pruebas para siempre.',
    tab1: 'Coche', tab2: 'Fotos', tab3: 'Daños', tab4: 'Informe',
    s1_title: 'Paso 1 de 4 — Tu coche',
    s1_lede: 'Rellena esto antes de salir. Tarda unos 30 segundos.',
    company_l: 'Empresa de alquiler',
    plate_l: 'Matrícula', plate_req: 'obligatorio',
    plate_hint: 'Está en el llavero o en el propio coche.',
    model_l: 'Marca y modelo',
    odo_l: 'Kilometraje',
    odo_hint: 'También se ve en la foto 8, un número exacto aquí es opcional.',
    fuel_l: 'Nivel de combustible', fuel_full: 'Lleno', fuel_empty: 'Vacío',
    fuel_hint: '¿Coche eléctrico? La foto 8 del salpicadero muestra la carga.',
    phase_l: '¿Cuándo revisas el coche?',
    pickup: 'Recogida', pickup_sub: 'Antes de salir',
    return: 'Devolución', return_sub: 'Al devolver el coche',
    cmp_t: 'Comparar con el informe de recogida',
    cmp_hint: 'Carga el archivo que guardaste al recoger el coche. Los daños antiguos se muestran en gris; solo los nuevos cuentan.',
    cmp_btn: 'Cargar archivo de recogida',
    cmp_loaded: 'Cargado: {n} marcas de la recogida del {date}',
    cmp_bad: 'Ese archivo no es un archivo de recogida de DingProof.',
    geo_t: '¿Añadir la ubicación?',
    geo_hint: 'Esto demuestra dónde estaba el coche. Se pregunta una vez y queda en tu teléfono.',
    geo_btn: 'Usar mi ubicación', geo_none: 'Ubicación no registrada',
    geo_saved: 'Ubicación guardada', geo_na: 'No disponible', geo_asking: 'Solicitando…',
    next_photos: 'Siguiente: hacer fotos',
    s2_title: 'Paso 2 de 4 — 8 fotos',
    s2_lede: 'Rodea el coche en una dirección. Ponte a unos dos pasos de distancia. Toca cada casilla en orden.',
    photos_taken: 'fotos hechas',
    s1n: 'Frente', s2n: 'Esquina delantera derecha', s3n: 'Lado derecho', s4n: 'Esquina trasera derecha',
    s5n: 'Parte trasera', s6n: 'Esquina trasera izquierda', s7n: 'Lado izquierdo', s8n: 'Techo, cristales, interior, cuentakilómetros',
    s1h: 'Colócate delante del coche. Todo el frente en la foto.',
    s2h: 'Ve a la esquina derecha. Muestra el parachoques y el guardabarros juntos.',
    s3h: 'Todo el lado derecho, ambas ruedas en la foto.',
    s4h: 'Muestra el parachoques trasero y el guardabarros derecho.',
    s5h: 'Colócate detrás del coche. Incluye la matrícula y ambas luces.',
    s6h: 'Muestra el parachoques trasero y el guardabarros izquierdo.',
    s7h: 'Todo el lado izquierdo, ambas ruedas en la foto.',
    s8h: 'Una foto del techo y el parabrisas, más el salpicadero mostrando los kilómetros.',
    take: 'Hacer foto', retake: 'Repetir foto', working: 'Procesando…', tryagain: 'Inténtalo de nuevo',
    read_err: 'No se pudo leer esa foto. Por favor, hazla de nuevo.',
    ph_dark: 'Esta foto parece oscura. Repítela si puedes.',
    ph_blur: 'Esta foto parece borrosa. Repítela si puedes.',
    vid_t: 'Vídeo del recorrido (opcional)',
    vid_hint: '30 segundos alrededor del coche en una sola toma. Un vídeo es aún más difícil de rebatir que las fotos. Se guarda como archivo aparte, junto al PDF.',
    vid_btn: 'Grabar vídeo', vid_re: 'Grabar de nuevo', vid_ok: 'Grabado · {size}', vid_rm: 'Quitar',
    back: 'Atrás', next_damage: 'Siguiente: marcar daños',
    s3_title: 'Paso 3 de 4 — Marca los daños',
    s3_lede: 'Toca el coche donde veas un rayón, abolladura o grieta. Una marca por cada problema. Si el coche está perfecto, salta este paso.',
    svg_hint: 'Toca el coche para añadir una marca.',
    pk_legend: 'Chinchetas grises P1–P{n}: daños ya registrados en la recogida.',
    no_marks: 'Todavía no hay daños marcados.', remove: 'Quitar',
    add_cu: 'Añadir primer plano', replace: 'Reemplazar',
    dlg_t: '¿Qué encontraste aquí?',
    dt0: 'Rayón', dt1: 'Abolladura', dt2: 'Roce en la llanta', dt3: 'Astilla o grieta',
    dt4: 'Pieza faltante', dt5: 'Mancha o rotura', dt6: 'Otro',
    note_l: 'Nota (opcional)', note_ph: 'ej. rayón profundo, unos 10 cm',
    note_latin: 'Consejo: una nota en inglés se ve mejor en el PDF.',
    cu_l: 'Primer plano (opcional)',
    cu_hint: 'Una foto de este punto exacto. Aparece en el informe en su propia página.',
    cu_take: 'Tomar primer plano', cu_re: 'Repetir', cu_rm: 'Quitar foto',
    cancel: 'Cancelar', addmark: 'Añadir marca',
    next_report: 'Siguiente: mi informe',
    s4_title: 'Paso 4 de 4 — Tu informe',
    s4_lede: 'Revisa el resumen y descarga el PDF. Envíatelo por correo para tener siempre una copia.',
    sum_phase: 'Inspección', sum_company: 'Empresa de alquiler', sum_plate: 'Matrícula',
    sum_model: 'Marca y modelo', sum_odo: 'Kilometraje', sum_fuel: 'Combustible',
    sum_photos: 'Fotos hechas', sum_marks: 'Marcas de daño', sum_cu: 'Primeros planos',
    sum_video: 'Vídeo del recorrido', sum_cmp: 'Archivo de recogida', sum_loc: 'Ubicación',
    notgiven: 'No indicado', notrec: 'No registrada', yes: 'Sí', none_w: 'Ninguno',
    n_of_n: '{a} de {b}',
    cmp_sum: '{n} marcas antiguas, recogida del {date}',
    warn0_t: 'No has hecho ninguna foto del coche.',
    warn0_x: 'Tu informe mostrará los daños marcados, pero no el coche en sí. Las fotos de todo el coche son la prueba más fuerte. Tarda alrededor de un minuto.',
    warn0_b: 'Hacer las 8 fotos',
    warnN_t1: 'Falta 1 de las 8 fotos.',
    warnN_t: 'Faltan {n} de las 8 fotos.',
    warnN_x: 'Tienes {a}. Las que faltan no estarán en el informe. Vuelve atrás y hazlas si puedes.',
    warnN_b: 'Hacer las fotos que faltan',
    dl_btn: 'Descargar informe en PDF',
    share_btn: 'Compartir el PDF', vid_dl: 'Descargar vídeo',
    save_pickup: 'Guardar archivo de recogida',
    save_pickup_hint: 'El archivo de recogida es un pequeño archivo extra. Cárgalo en la devolución y solo contarán los daños nuevos.',
    dispute_btn: 'Copiar texto para reclamar',
    copied: 'Copiado. Pégalo en tu correo. El texto está en inglés a propósito.',
    copy_fail: 'No se pudo copiar en este dispositivo.',
    st_build: 'Creando tu PDF…',
    st_saved: 'Guardado como {name}',
    st_savefail: 'No se pudo guardar el archivo en este dispositivo.',
    st_nolib: 'La herramienta de PDF no se cargó. Revisa la conexión y recarga la página.',
    st_cancel: 'Descarga cancelada. Toca de nuevo para intentarlo.',
    st_big: 'Este archivo es demasiado grande para guardarlo aquí. Un vídeo más corto sí cabrá.',
    st_wait: 'Confirma la descarga cuando lo pida el navegador…',
    disc_t: 'Por favor, lee esto.',
    disc_x: 'Este informe es tu propia documentación del coche. No es un documento oficial y no obliga automáticamente a la empresa de alquiler ni a nadie más. Es una prueba que has creado tú mismo, con fechas y fotos, para respaldar tu versión si hay una disputa.',
    priv: 'Todo permanece en tu teléfono. Tus fotos nunca se suben y nada se guarda al cerrar esta página.',
    foot: 'DingProof es gratis y funciona por completo en el navegador. Sin cuentas, sin seguimiento, sin subidas.',
    reset_btn: 'Nuevo coche',
    reset_confirm: 'Esto borra tus fotos y marcas. ¿Continuar?',
    pdf_en_note: 'El PDF en sí está escrito en inglés, para que las empresas de alquiler de cualquier lugar puedan leerlo.',
    install_t: 'Añade DingProof a tu pantalla de inicio para que se abra al instante, incluso sin cobertura.',
    install_btn: 'Añadir a la pantalla de inicio'
  };

  var RTL_LANGS = { he: true };
  var lang = 'en';

  function t(key, vars) {
    var s = (STR[lang] && STR[lang][key]) || STR.en[key] || key;
    if (vars) {
      Object.keys(vars).forEach(function (k) {
        s = s.split('{' + k + '}').join(vars[k]);
      });
    }
    return s;
  }

  function applyTranslations() {
    document.documentElement.lang = lang;
    document.documentElement.dir = RTL_LANGS[lang] ? 'rtl' : 'ltr';
    var nodes = document.querySelectorAll('[data-i18n]');
    for (var i = 0; i < nodes.length; i++) {
      var key = nodes[i].getAttribute('data-i18n');
      nodes[i].textContent = t(key);
    }
    $('#plate').placeholder = 'AB 123 CD';
    $('#markNote').placeholder = t('note_ph');
    var btns = document.querySelectorAll('.lang-btn');
    for (var j = 0; j < btns.length; j++) {
      btns[j].classList.toggle('is-active', btns[j].getAttribute('data-lang') === lang);
    }
    buildShotList();
    buildTypeGrid();
    updateShotCount();
    renderMarks();
    renderVideoUI();
    if (state.step === 4) { renderSummary(); }
  }

  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest ? ev.target.closest('.lang-btn') : null;
    if (btn) { lang = btn.getAttribute('data-lang'); applyTranslations(); }
  });

  /* ---------------------------------------------------------------
     State — memory only. Never localStorage / sessionStorage.
  --------------------------------------------------------------- */

  var state = {
    step: 1,
    photos: {},        // key -> { dataUrl, width, height, takenAt, quality }
    marks: [],         // { id, x, y, type, note, photo, at }
    geo: null,
    geoAsked: false,
    pendingPoint: null,
    pendingType: null,
    pendingPhoto: null,
    video: null,        // { blob, url, size, mime, ext }
    pickup: null         // { marks:[{x,y,type}], at:{...} } loaded from a pickup file
  };

  var uid = 0;
  function nextId() { uid += 1; return uid; }

  /* ---------------------------------------------------------------
     Helpers
  --------------------------------------------------------------- */

  var $ = function (sel, root) { return (root || document).querySelector(sel); };

  function pad(n) { return n < 10 ? '0' + n : String(n); }

  function stamp(date) {
    var d = date || new Date();
    var local;
    try { local = d.toLocaleString(); } catch (e) { local = d.toString(); }
    return { local: local, iso: d.toISOString().replace(/\.\d{3}Z$/, 'Z'), date: d };
  }

  function stampText(s) { return s.local + '  (' + s.iso + ' UTC)'; }

  function fileDateStr(d) {
    return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate());
  }

  function trip() {
    var phaseEl = document.querySelector('input[name="phase"]:checked');
    var fuelEl = document.querySelector('input[name="fuel"]:checked');
    return {
      company: $('#company').value.trim(),
      plate: $('#plate').value.trim().toUpperCase(),
      model: $('#model').value.trim(),
      odometer: $('#odometer').value.trim(),
      fuel: fuelEl ? fuelEl.value : 'Full',
      phase: phaseEl ? phaseEl.value : 'Pickup'
    };
  }

  function photoCount() { return Object.keys(state.photos).length; }
  function markPhotoCount() { return state.marks.filter(function (m) { return !!m.photo; }).length; }
  function hasData() {
    return photoCount() > 0 || state.marks.length > 0 || !!state.video;
  }
  function safePlate(plate) {
    var p = (plate || '').replace(/[^A-Za-z0-9]/g, '');
    return p || 'NOPLATE';
  }
  function isLatin(str) { return !/[^\x00-\x7F]/.test(str || ''); }
  function bytesLabel(n) {
    if (n > 1024 * 1024) { return (n / (1024 * 1024)).toFixed(1) + ' MB'; }
    return Math.round(n / 1024) + ' KB';
  }

  /* ---------------------------------------------------------------
     Step navigation
  --------------------------------------------------------------- */

  function goto(step) {
    state.step = step;
    var panels = document.querySelectorAll('.step');
    for (var i = 0; i < panels.length; i++) {
      var n = Number(panels[i].getAttribute('data-step'));
      panels[i].classList.toggle('is-hidden', n !== step);
    }
    var tabs = document.querySelectorAll('.step-tab');
    for (var j = 0; j < tabs.length; j++) {
      var tnum = Number(tabs[j].getAttribute('data-goto'));
      tabs[j].classList.toggle('is-active', tnum === step);
      tabs[j].classList.toggle('is-done', tnum < step);
      if (tnum === step) { tabs[j].setAttribute('aria-current', 'step'); }
      else { tabs[j].removeAttribute('aria-current'); }
    }
    $('#progressBar').style.width = (step * 25) + '%';
    if (step === 4) { renderSummary(); }
    window.scrollTo(0, 0);
  }

  document.addEventListener('click', function (ev) {
    var btn = ev.target.closest ? ev.target.closest('[data-goto]') : null;
    if (btn) { goto(Number(btn.getAttribute('data-goto'))); }
  });

  /* ---------------------------------------------------------------
     Pickup-report comparison
  --------------------------------------------------------------- */

  function updateCompareVisibility() {
    var phaseEl = document.querySelector('input[name="phase"]:checked');
    var isReturn = phaseEl && phaseEl.value === 'Return';
    $('#compareBox').classList.toggle('is-hidden', !isReturn);
  }
  document.addEventListener('change', function (ev) {
    if (ev.target && ev.target.name === 'phase') { updateCompareVisibility(); }
  });

  $('#pickupFile').addEventListener('change', function () {
    var input = $('#pickupFile');
    if (!input.files || !input.files[0]) { return; }
    var reader = new FileReader();
    reader.onload = function () {
      try {
        var data = JSON.parse(String(reader.result));
        if (!data || data.app !== 'DingProof' || !Array.isArray(data.marks)) {
          throw new Error('shape');
        }
        state.pickup = data;
        var el = $('#compareStatus');
        el.classList.add('is-on');
        el.textContent = t('cmp_loaded', { n: data.marks.length, date: data.createdLocal || '' });
        renderMarks();
      } catch (e) {
        var el2 = $('#compareStatus');
        el2.classList.remove('is-on');
        el2.textContent = t('cmp_bad');
      }
      input.value = '';
    };
    reader.readAsText(input.files[0]);
  });

  function buildPickupFile() {
    var tr = trip();
    var now = stamp();
    return {
      app: 'DingProof',
      version: 1,
      plate: tr.plate,
      createdLocal: now.local,
      createdIso: now.iso,
      marks: state.marks.map(function (m) { return { x: m.x, y: m.y, type: m.type }; })
    };
  }

  $('#pickupSaveBtn').addEventListener('click', function () {
    var data = buildPickupFile();
    var tr = trip();
    var name = 'DingProof_pickup_' + safePlate(tr.plate) + '_' + fileDateStr(new Date()) + '.json';
    var text = JSON.stringify(data, null, 2);
    var status = $('#extraStatus');
    status.classList.remove('is-on');

    function localSave() {
      try {
        var blob = new Blob([text], { type: 'application/json' });
        var url = URL.createObjectURL(blob);
        var a = document.createElement('a');
        a.href = url; a.download = name;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
        status.classList.add('is-on');
        status.textContent = t('st_saved', { name: name });
      } catch (e) {
        status.textContent = t('st_savefail');
      }
    }
    if (!window.__dpHostSave) { localSave(); return; }
    window.__dpHostSave(name, text)['catch'](function () { return 'nohost'; }).then(function (r) {
      if (r === 'nohost' || !r) { localSave(); return; }
      status.classList.add('is-on');
      status.textContent = t('st_saved', { name: name });
    });
  });

  /* ---------------------------------------------------------------
     Step 2 — photos
  --------------------------------------------------------------- */

  function buildShotList() {
    var list = $('#shotList');
    list.innerHTML = '';
    SHOTS.forEach(function (shot, i) {
      var li = document.createElement('li');
      li.className = 'shot';
      li.id = 'shot-' + shot.key;

      var idx = document.createElement('span');
      idx.className = 'shot-index mono';
      idx.textContent = String(i + 1);

      var main = document.createElement('div');
      main.className = 'shot-main';

      var title = document.createElement('p');
      title.className = 'shot-title';
      title.textContent = t('s' + (i + 1) + 'n');
      var how = document.createElement('p');
      how.className = 'shot-how';
      how.textContent = t('s' + (i + 1) + 'h');

      var quality = document.createElement('p');
      quality.className = 'shot-quality is-hidden';

      var foot = document.createElement('div');
      foot.className = 'shot-foot';

      var img = document.createElement('img');
      img.className = 'shot-thumb is-hidden';
      img.alt = '';

      var time = document.createElement('p');
      time.className = 'shot-time mono is-hidden';

      var input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.setAttribute('capture', 'environment');
      input.id = 'file-' + shot.key;

      var label = document.createElement('label');
      label.className = 'shot-cta';
      label.setAttribute('for', input.id);
      label.textContent = t('take');

      foot.appendChild(img);
      foot.appendChild(time);
      foot.appendChild(input);
      foot.appendChild(label);

      main.appendChild(title);
      main.appendChild(how);
      main.appendChild(quality);
      main.appendChild(foot);

      input.addEventListener('change', function () {
        if (!input.files || !input.files[0]) { return; }
        label.textContent = t('working');
        shrinkImage(input.files[0], function (err, result) {
          input.value = '';
          if (err) {
            label.textContent = t('tryagain');
            alert(t('read_err'));
            return;
          }
          result.takenAt = stamp();
          state.photos[shot.key] = result;
          renderShot(shot, li, img, label, time, quality, result);
          updateShotCount();
        });
      });

      // Re-render an already-taken shot so language switches keep its state.
      var existing = state.photos[shot.key];
      li.appendChild(idx);
      li.appendChild(main);
      list.appendChild(li);
      if (existing) { renderShot(shot, li, img, label, time, quality, existing); }
    });
  }

  function renderShot(shot, li, img, label, time, quality, p) {
    li.classList.add('is-done');
    img.src = p.dataUrl;
    img.classList.remove('is-hidden');
    label.textContent = t('retake');
    time.textContent = p.takenAt.local;
    time.classList.remove('is-hidden');
    if (p.quality === 'dark' || p.quality === 'blur') {
      quality.textContent = p.quality === 'dark' ? t('ph_dark') : t('ph_blur');
      quality.classList.remove('is-hidden');
    } else {
      quality.classList.add('is-hidden');
    }
  }

  function updateShotCount() {
    $('#shotCount').textContent = photoCount() + ' / ' + SHOTS.length;
  }

  // Cheap, honest brightness/sharpness estimate from a downsampled canvas:
  // average luma flags a too-dark shot, and average gradient magnitude
  // (a crude Laplacian) flags a blurry one. Good enough to nudge a retake,
  // not meant to be a real image-quality pipeline.
  function assessQuality(ctx, w, h) {
    var data = ctx.getImageData(0, 0, w, h).data;
    var lumaSum = 0, n = w * h;
    var luma = new Float32Array(n);
    for (var i = 0, p = 0; i < n; i++, p += 4) {
      var l = 0.299 * data[p] + 0.587 * data[p + 1] + 0.114 * data[p + 2];
      luma[i] = l;
      lumaSum += l;
    }
    var avgLuma = lumaSum / n;
    var gradSum = 0, gradCount = 0;
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        var idx = y * w + x;
        var gx = luma[idx + 1] - luma[idx - 1];
        var gy = luma[idx + w] - luma[idx - w];
        gradSum += Math.abs(gx) + Math.abs(gy);
        gradCount++;
      }
    }
    var avgGrad = gradCount ? gradSum / gradCount : 0;
    if (avgLuma < 38) { return 'dark'; }
    if (avgGrad < 4.2) { return 'blur'; }
    return 'ok';
  }

  // Resize with canvas so the PDF stays small. Returns a JPEG data URL plus
  // a rough quality read, done on the same downsampled canvas at no extra cost.
  function shrinkImage(file, done) {
    var url = URL.createObjectURL(file);
    var img = new Image();
    img.onload = function () {
      try {
        var w = img.naturalWidth || img.width;
        var h = img.naturalHeight || img.height;
        var scale = Math.min(1, MAX_EDGE / Math.max(w, h));
        var cw = Math.max(1, Math.round(w * scale));
        var ch = Math.max(1, Math.round(h * scale));

        var canvas = document.createElement('canvas');
        canvas.width = cw;
        canvas.height = ch;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, cw, ch);
        ctx.drawImage(img, 0, 0, cw, ch);

        var quality = 'ok';
        try {
          var qw = Math.min(160, cw), qh = Math.round(qw * (ch / cw));
          var qc = document.createElement('canvas');
          qc.width = qw; qc.height = qh;
          var qctx = qc.getContext('2d');
          qctx.drawImage(canvas, 0, 0, qw, qh);
          quality = assessQuality(qctx, qw, qh);
        } catch (qe) { quality = 'ok'; }

        var dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY);
        URL.revokeObjectURL(url);
        done(null, { dataUrl: dataUrl, width: cw, height: ch, quality: quality });
      } catch (e) {
        URL.revokeObjectURL(url);
        done(e);
      }
    };
    img.onerror = function () {
      URL.revokeObjectURL(url);
      done(new Error('decode failed'));
    };
    img.src = url;
  }

  /* ---------------------------------------------------------------
     Walk-around video (optional, kept as its own file)
  --------------------------------------------------------------- */

  var MAX_VIDEO_BYTES = 15 * 1024 * 1024; // stays clear of the 16MB host cap

  function renderVideoUI() {
    var status = $('#videoStatus');
    var btn = $('#videoBtn');
    var rm = $('#videoRemove');
    if (state.video) {
      status.textContent = t('vid_ok', { size: bytesLabel(state.video.size) });
      status.classList.add('is-on');
      btn.textContent = t('vid_re');
      rm.classList.remove('is-hidden');
    } else {
      status.textContent = '';
      status.classList.remove('is-on');
      btn.textContent = t('vid_btn');
      rm.classList.add('is-hidden');
    }
  }

  $('#videoInput').addEventListener('change', function () {
    var input = $('#videoInput');
    if (!input.files || !input.files[0]) { return; }
    var file = input.files[0];
    input.value = '';
    if (state.video && state.video.url) { URL.revokeObjectURL(state.video.url); }
    state.video = {
      blob: file,
      url: URL.createObjectURL(file),
      size: file.size,
      mime: file.type || 'video/mp4',
      ext: (file.name && /\.(\w+)$/.test(file.name)) ? RegExp.$1 : 'mp4',
      takenAt: stamp()
    };
    renderVideoUI();
  });

  $('#videoRemove').addEventListener('click', function () {
    if (state.video && state.video.url) { URL.revokeObjectURL(state.video.url); }
    state.video = null;
    renderVideoUI();
  });

  /* ---------------------------------------------------------------
     Step 3 — damage diagram
  --------------------------------------------------------------- */

  var svg = $('#carSvg');
  var SVGNS = 'http://www.w3.org/2000/svg';

  // Screen coordinates -> SVG user coordinates, correct at any screen size.
  function toSvgPoint(clientX, clientY) {
    var pt = svg.createSVGPoint();
    pt.x = clientX;
    pt.y = clientY;
    var ctm = svg.getScreenCTM();
    if (!ctm) { return null; }
    var local = pt.matrixTransform(ctm.inverse());
    return { x: local.x, y: local.y };
  }

  svg.addEventListener('click', function (ev) {
    var p = toSvgPoint(ev.clientX, ev.clientY);
    if (p) { openMarkModal(p); }
  });

  svg.addEventListener('keydown', function (ev) {
    if (ev.key === 'Enter' || ev.key === ' ') {
      ev.preventDefault();
      openMarkModal({ x: 160, y: 310 });
    }
  });

  function renderPickupPins() {
    var layer = $('#pickupLayer');
    while (layer.firstChild) { layer.removeChild(layer.firstChild); }
    var legend = $('#pickupLegend');
    if (!state.pickup || !state.pickup.marks || !state.pickup.marks.length) {
      legend.classList.add('is-hidden');
      return;
    }
    state.pickup.marks.forEach(function (m, i) {
      var g = document.createElementNS(SVGNS, 'g');
      g.setAttribute('class', 'ppin');
      var c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('cx', m.x); c.setAttribute('cy', m.y); c.setAttribute('r', '11');
      var txt = document.createElementNS(SVGNS, 'text');
      txt.setAttribute('x', m.x); txt.setAttribute('y', m.y);
      txt.textContent = 'P' + (i + 1);
      g.appendChild(c); g.appendChild(txt);
      layer.appendChild(g);
    });
    legend.textContent = t('pk_legend', { n: state.pickup.marks.length });
    legend.classList.remove('is-hidden');
  }

  function buildTypeGrid() {
    var grid = $('#typeGrid');
    grid.innerHTML = '';
    DAMAGE_TYPES.forEach(function (type, i) {
      var b = document.createElement('button');
      b.type = 'button';
      b.className = 'type-btn';
      b.textContent = t('dt' + i);
      b.setAttribute('role', 'radio');
      b.setAttribute('aria-checked', 'false');
      b.addEventListener('click', function () {
        state.pendingType = type;
        var all = grid.querySelectorAll('.type-btn');
        for (var k = 0; k < all.length; k++) {
          var on = all[k] === b;
          all[k].classList.toggle('is-picked', on);
          all[k].setAttribute('aria-checked', on ? 'true' : 'false');
        }
      });
      grid.appendChild(b);
    });
  }

  var lastFocused = null;

  function showPendingPhoto() {
    var thumb = $('#markPhotoThumb');
    var rm = $('#markPhotoRemove');
    var btn = $('#markPhotoBtn');
    if (state.pendingPhoto) {
      thumb.src = state.pendingPhoto.dataUrl;
      thumb.classList.remove('is-hidden');
      rm.classList.remove('is-hidden');
      btn.textContent = t('cu_re');
    } else {
      thumb.removeAttribute('src');
      thumb.classList.add('is-hidden');
      rm.classList.add('is-hidden');
      btn.textContent = t('cu_take');
    }
  }

  $('#markPhotoInput').addEventListener('change', function () {
    var input = $('#markPhotoInput');
    if (!input.files || !input.files[0]) { return; }
    $('#markPhotoBtn').textContent = t('working');
    shrinkImage(input.files[0], function (err, result) {
      input.value = '';
      if (err) { showPendingPhoto(); alert(t('read_err')); return; }
      result.takenAt = stamp();
      state.pendingPhoto = result;
      showPendingPhoto();
    });
  });

  $('#markPhotoRemove').addEventListener('click', function () {
    state.pendingPhoto = null;
    showPendingPhoto();
  });

  function openMarkModal(point) {
    state.pendingPoint = point;
    state.pendingType = DAMAGE_TYPES[0];
    state.pendingPhoto = null;
    lastFocused = document.activeElement;

    var btns = $('#typeGrid').querySelectorAll('.type-btn');
    for (var i = 0; i < btns.length; i++) {
      var on = i === 0;
      btns[i].classList.toggle('is-picked', on);
      btns[i].setAttribute('aria-checked', on ? 'true' : 'false');
    }
    $('#markNote').value = '';
    $('#noteLatinHint').classList.add('is-hidden');
    showPendingPhoto();
    $('#markModal').classList.remove('is-hidden');
    btns[0].focus();
  }

  function closeMarkModal() {
    $('#markModal').classList.add('is-hidden');
    state.pendingPoint = null;
    state.pendingPhoto = null;
    if (lastFocused && lastFocused.focus) { lastFocused.focus(); }
  }

  $('#markCancel').addEventListener('click', closeMarkModal);
  $('#markModal').addEventListener('click', function (ev) {
    if (ev.target === $('#markModal')) { closeMarkModal(); }
  });
  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && !$('#markModal').classList.contains('is-hidden')) { closeMarkModal(); }
  });

  // A note in a non-Latin script prints fine in the app but the PDF text
  // layer is Latin-only, so flag it gently rather than fail silently later.
  $('#markNote').addEventListener('input', function () {
    $('#noteLatinHint').classList.toggle('is-hidden', isLatin($('#markNote').value) || lang === 'en');
  });

  $('#markSave').addEventListener('click', function () {
    if (!state.pendingPoint) { return; }
    state.marks.push({
      id: nextId(),
      x: state.pendingPoint.x,
      y: state.pendingPoint.y,
      type: state.pendingType || DAMAGE_TYPES[0],
      note: $('#markNote').value.trim(),
      photo: state.pendingPhoto,
      at: stamp()
    });
    closeMarkModal();
    renderMarks();
  });

  function renderMarks() {
    renderPickupPins();

    var layer = $('#pinLayer');
    while (layer.firstChild) { layer.removeChild(layer.firstChild); }
    state.marks.forEach(function (m, i) {
      var g = document.createElementNS(SVGNS, 'g');
      g.setAttribute('class', 'pin');
      var c = document.createElementNS(SVGNS, 'circle');
      c.setAttribute('cx', m.x); c.setAttribute('cy', m.y); c.setAttribute('r', '13');
      var txt = document.createElementNS(SVGNS, 'text');
      txt.setAttribute('x', m.x); txt.setAttribute('y', m.y);
      txt.textContent = String(i + 1);
      g.appendChild(c); g.appendChild(txt);
      layer.appendChild(g);
    });

    var typeIndex = {};
    DAMAGE_TYPES.forEach(function (dt, i) { typeIndex[dt] = i; });

    var list = $('#markList');
    list.innerHTML = '';
    state.marks.forEach(function (m, i) {
      var li = document.createElement('li');
      li.className = 'mark';

      var num = document.createElement('span');
      num.className = 'mark-num mono';
      num.textContent = String(i + 1);

      var body = document.createElement('div');
      body.className = 'mark-body';
      var type = document.createElement('p');
      type.className = 'mark-type';
      type.textContent = t('dt' + (typeIndex[m.type] || 0));
      body.appendChild(type);
      if (m.note) {
        var note = document.createElement('p');
        note.className = 'mark-note';
        note.textContent = m.note;
        body.appendChild(note);
      }
      var time = document.createElement('p');
      time.className = 'mark-time mono';
      time.textContent = m.at.local;
      body.appendChild(time);

      var shot = document.createElement('div');
      shot.className = 'mark-shot';
      var shotImg = document.createElement('img');
      shotImg.className = 'mark-shot-thumb';
      shotImg.alt = '';
      if (m.photo) { shotImg.src = m.photo.dataUrl; } else { shotImg.className += ' is-hidden'; }

      var shotInput = document.createElement('input');
      shotInput.type = 'file';
      shotInput.accept = 'image/*';
      shotInput.setAttribute('capture', 'environment');
      shotInput.id = 'markshot-' + m.id;

      var shotLabel = document.createElement('label');
      shotLabel.className = 'mark-shot-cta';
      shotLabel.setAttribute('for', shotInput.id);
      shotLabel.textContent = m.photo ? t('replace') : t('add_cu');

      shotInput.addEventListener('change', function () {
        if (!shotInput.files || !shotInput.files[0]) { return; }
        shotLabel.textContent = t('working');
        shrinkImage(shotInput.files[0], function (err, result) {
          shotInput.value = '';
          if (err) {
            shotLabel.textContent = m.photo ? t('replace') : t('add_cu');
            alert(t('read_err'));
            return;
          }
          result.takenAt = stamp();
          m.photo = result;
          renderMarks();
        });
      });

      shot.appendChild(shotImg);
      shot.appendChild(shotInput);
      shot.appendChild(shotLabel);
      body.appendChild(shot);

      var rm = document.createElement('button');
      rm.type = 'button';
      rm.className = 'mark-remove';
      rm.textContent = t('remove');
      rm.setAttribute('aria-label', t('remove') + ' ' + (i + 1));
      rm.addEventListener('click', function () {
        state.marks = state.marks.filter(function (x) { return x.id !== m.id; });
        renderMarks();
      });

      li.appendChild(num);
      li.appendChild(body);
      li.appendChild(rm);
      list.appendChild(li);
    });

    $('#markEmpty').classList.toggle('is-hidden', state.marks.length > 0);
  }

  /* ---------------------------------------------------------------
     Geolocation — asked once, never blocking
  --------------------------------------------------------------- */

  function setGeoStatus(text, ok) {
    var el = $('#geoStatus');
    el.textContent = text;
    el.classList.toggle('is-on', !!ok);
  }

  $('#geoBtn').addEventListener('click', function () {
    var btn = $('#geoBtn');
    if (state.geoAsked) { return; }
    if (!navigator.geolocation) {
      state.geoAsked = true;
      setGeoStatus(t('geo_none'), false);
      btn.disabled = true;
      return;
    }
    state.geoAsked = true;
    btn.disabled = true;
    setGeoStatus(t('geo_asking'), false);
    navigator.geolocation.getCurrentPosition(
      function (pos) {
        state.geo = {
          lat: pos.coords.latitude,
          lon: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
          at: stamp()
        };
        setGeoStatus(
          state.geo.lat.toFixed(5) + ', ' + state.geo.lon.toFixed(5) +
          ' (±' + Math.round(state.geo.accuracy) + ' m)', true
        );
        btn.textContent = t('geo_saved');
      },
      function () {
        state.geo = null;
        setGeoStatus(t('geo_none'), false);
        btn.textContent = t('geo_na');
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 0 }
    );
  });

  /* ---------------------------------------------------------------
     Step 4 — summary
  --------------------------------------------------------------- */

  function addRow(dl, key, value, warn) {
    var d = document.createElement('div');
    var dt = document.createElement('dt');
    dt.textContent = key;
    var dd = document.createElement('dd');
    dd.textContent = value;
    if (warn) { dd.className = 'warn'; }
    d.appendChild(dt);
    d.appendChild(dd);
    dl.appendChild(d);
  }

  function renderSummary() {
    var tr = trip();
    var dl = $('#summary');
    dl.innerHTML = '';
    var phaseLabel = tr.phase === 'Return' ? t('return') : t('pickup');
    addRow(dl, t('sum_phase'), phaseLabel);
    addRow(dl, t('sum_company'), tr.company || t('notgiven'), !tr.company);
    addRow(dl, t('sum_plate'), tr.plate || t('notgiven'), !tr.plate);
    addRow(dl, t('sum_model'), tr.model || t('notgiven'), !tr.model);
    addRow(dl, t('sum_odo'), tr.odometer || t('notgiven'), !tr.odometer);
    addRow(dl, t('sum_fuel'), tr.fuel);
    addRow(dl, t('sum_photos'), t('n_of_n', { a: photoCount(), b: SHOTS.length }), photoCount() < SHOTS.length);
    addRow(dl, t('sum_marks'), String(state.marks.length));
    if (state.marks.length) {
      addRow(dl, t('sum_cu'), t('n_of_n', { a: markPhotoCount(), b: state.marks.length }), markPhotoCount() < state.marks.length);
    }
    addRow(dl, t('sum_video'), state.video ? t('yes') : t('none_w'));
    if (state.pickup) {
      addRow(dl, t('sum_cmp'), t('cmp_sum', { n: state.pickup.marks.length, date: state.pickup.createdLocal || '' }));
    }
    addRow(dl, t('sum_loc'),
      state.geo ? state.geo.lat.toFixed(5) + ', ' + state.geo.lon.toFixed(5) : t('notrec'),
      !state.geo);

    renderPhotoWarning();
    renderExtraButtons();
  }

  function renderPhotoWarning() {
    var box = $('#photoWarn');
    var have = photoCount();
    var missing = SHOTS.length - have;

    if (missing === 0) { box.classList.add('is-hidden'); return; }

    if (have === 0) {
      $('#photoWarnTitle').textContent = t('warn0_t');
      $('#photoWarnText').textContent = t('warn0_x');
      $('#photoWarnBtn').textContent = t('warn0_b');
    } else {
      $('#photoWarnTitle').textContent = missing === 1 ? t('warnN_t1') : t('warnN_t', { n: missing });
      $('#photoWarnText').textContent = t('warnN_x', { a: have });
      $('#photoWarnBtn').textContent = t('warnN_b');
    }
    box.classList.remove('is-hidden');
  }

  function renderExtraButtons() {
    $('#videoDlBtn').classList.toggle('is-hidden', !state.video);
    $('#pickupSaveBtn').classList.toggle('is-hidden', !!state.pickup);
    $('#pickupSaveHint').classList.toggle('is-hidden', !!state.pickup);
    $('#shareBtn').classList.toggle('is-hidden', !(navigator.share && navigator.canShare));
    $('#pdfEnNote').classList.toggle('is-hidden', lang === 'en');
  }

  /* ---------------------------------------------------------------
     PDF export
  --------------------------------------------------------------- */

  // Renders the SVG diagram plus its pins (and, at return, the pickup's
  // grey pins) into a PNG data URL for the PDF.
  function diagramToPng(cb) {
    try {
      var clone = svg.cloneNode(true);
      clone.setAttribute('xmlns', SVGNS);
      clone.setAttribute('width', '640');
      clone.setAttribute('height', '1240');
      clone.removeAttribute('tabindex');

      var shapes = clone.querySelectorAll('#carArt *');
      for (var s = 0; s < shapes.length; s++) {
        var f = shapes[s].getAttribute('fill');
        var st = shapes[s].getAttribute('stroke');
        if (f && PRINT_FILL[f]) { shapes[s].setAttribute('fill', PRINT_FILL[f]); }
        if (st && PRINT_STROKE[st]) { shapes[s].setAttribute('stroke', PRINT_STROKE[st]); }
      }

      var ppins = clone.querySelectorAll('.ppin');
      for (var q = 0; q < ppins.length; q++) {
        var pc = ppins[q].querySelector('circle');
        var pt = ppins[q].querySelector('text');
        if (pc) { pc.setAttribute('fill', '#9AA5B4'); pc.setAttribute('stroke', '#FFFFFF'); pc.setAttribute('stroke-width', '2'); }
        if (pt) { pt.setAttribute('fill', '#20242C'); pt.setAttribute('font-family', 'monospace'); pt.setAttribute('font-size', '13'); pt.setAttribute('font-weight', 'bold'); pt.setAttribute('text-anchor', 'middle'); pt.setAttribute('dominant-baseline', 'central'); }
      }

      var pins = clone.querySelectorAll('.pin');
      for (var i = 0; i < pins.length; i++) {
        var circle = pins[i].querySelector('circle');
        var label = pins[i].querySelector('text');
        if (circle) { circle.setAttribute('fill', '#FF5B49'); circle.setAttribute('stroke', '#FFFFFF'); circle.setAttribute('stroke-width', '2'); }
        if (label) { label.setAttribute('fill', '#FFFFFF'); label.setAttribute('font-family', 'monospace'); label.setAttribute('font-size', '15'); label.setAttribute('font-weight', 'bold'); label.setAttribute('text-anchor', 'middle'); label.setAttribute('dominant-baseline', 'central'); }
      }

      var bg = document.createElementNS(SVGNS, 'rect');
      bg.setAttribute('x', '0'); bg.setAttribute('y', '0');
      bg.setAttribute('width', '320'); bg.setAttribute('height', '620');
      bg.setAttribute('fill', '#FFFFFF');
      clone.insertBefore(bg, clone.firstChild);

      var xml = new XMLSerializer().serializeToString(clone);
      var url = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(xml);

      var img = new Image();
      img.onload = function () {
        var canvas = document.createElement('canvas');
        canvas.width = 640; canvas.height = 1240;
        var ctx = canvas.getContext('2d');
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        try { cb(canvas.toDataURL('image/png')); } catch (e) { cb(null); }
      };
      img.onerror = function () { cb(null); };
      img.src = url;
    } catch (e) { cb(null); }
  }

  var PRINT_FILL = {
    '#1E2530': '#F3F5F8', '#2A323E': '#DCE2EA', '#232B36': '#E9EDF2',
    '#11161D': '#4E5766', '#3A4452': '#C6CDD7', '#4A2A2A': '#E9C9C5',
    '#7C8899': '#5B6474'
  };
  var PRINT_STROKE = { '#5C6878': '#7A8494' };

  function buildPdf(done) {
    var jsPDFCtor = (window.jspdf && window.jspdf.jsPDF) || window.jsPDF;
    if (!jsPDFCtor) { done(new Error(t('st_nolib'))); return; }

    var tr = trip();
    var now = stamp();
    var doc = new jsPDFCtor({ unit: 'mm', format: 'a4', compress: true });
    var W = 210, H = 297, M = 15;
    var y = M;

    function line(text, size, style, colour) {
      doc.setFont('helvetica', style || 'normal');
      doc.setFontSize(size || 11);
      doc.setTextColor(colour || 40);
      var chunks = doc.splitTextToSize(text, W - M * 2);
      for (var i = 0; i < chunks.length; i++) {
        if (y > H - M) { doc.addPage('a4', 'portrait'); y = M; }
        doc.text(chunks[i], M, y);
        y += size ? size * 0.52 : 6;
      }
    }

    function pair(key, value) {
      doc.setFont('helvetica', 'bold'); doc.setFontSize(10); doc.setTextColor(90);
      if (y > H - M) { doc.addPage('a4', 'portrait'); y = M; }
      doc.text(key, M, y);
      doc.setFont('courier', 'normal'); doc.setTextColor(20);
      var chunks = doc.splitTextToSize(String(value), W - M * 2 - 55);
      for (var i = 0; i < chunks.length; i++) {
        doc.text(chunks[i], M + 55, y);
        y += 5.4;
        if (y > H - M && i < chunks.length - 1) { doc.addPage('a4', 'portrait'); y = M; }
      }
      if (!chunks.length) { y += 5.4; }
    }

    /* ---- Page 1: summary (always in English) ---- */
    doc.setFillColor(14, 17, 22);
    doc.rect(0, 0, W, 26, 'F');
    doc.setFont('helvetica', 'bold'); doc.setFontSize(18); doc.setTextColor(255, 197, 49);
    doc.text('DingProof', M, 13);
    doc.setFont('helvetica', 'normal'); doc.setFontSize(10); doc.setTextColor(230);
    doc.text('Vehicle condition report — ' + tr.phase, M, 20);
    doc.setFont('courier', 'normal');
    doc.text(tr.plate || 'NO PLATE', W - M, 20, { align: 'right' });

    y = 38;
    line('Vehicle and rental', 13, 'bold'); y += 2;
    pair('Inspection', tr.phase);
    pair('Rental company', tr.company || 'Not given');
    pair('Licence plate', tr.plate || 'Not given');
    pair('Make and model', tr.model || 'Not given');
    pair('Odometer', tr.odometer || 'Not given');
    pair('Fuel level', tr.fuel);

    y += 4;
    line('Report details', 13, 'bold'); y += 2;
    pair('Created (local)', now.local);
    pair('Created (UTC)', now.iso);
    pair('Photos included', photoCount() + ' of ' + SHOTS.length);
    pair('Walk-around video', state.video ? 'Yes, saved as a separate file' : 'No');
    pair('Damage marks', String(state.marks.length));
    pair('Close-up photos', String(markPhotoCount()));
    if (state.pickup) {
      pair('Compared with pickup', state.pickup.marks.length + ' old mark(s), pickup of ' + (state.pickup.createdLocal || 'unknown date'));
    }
    if (state.geo) {
      pair('Latitude', state.geo.lat.toFixed(6));
      pair('Longitude', state.geo.lon.toFixed(6));
      pair('Accuracy', Math.round(state.geo.accuracy) + ' m');
      pair('Location taken', state.geo.at.iso);
    } else {
      pair('Location', 'Location not recorded');
    }

    y += 4;
    line('Damage marked by the driver', 13, 'bold'); y += 2;
    if (!state.marks.length) {
      line('No damage was marked during this inspection.', 10, 'normal', 90);
    } else {
      state.marks.forEach(function (m, i) {
        line((i + 1) + '. ' + m.type + (m.note ? ' — ' + m.note : ''), 11, 'bold');
        line('    ' + stampText(m.at), 9, 'normal', 110);
        if (m.photo) { line('    Close-up photo included in this report.', 9, 'normal', 110); }
        y += 1;
      });
    }
    if (state.pickup && state.pickup.marks.length) {
      y += 3;
      line('For comparison, ' + state.pickup.marks.length + ' mark(s) were already recorded at pickup ' +
        '(' + (state.pickup.createdLocal || 'date unknown') + '). They appear as grey numbered pins ' +
        '(P1, P2, …) on the diagram on the next page.', 9, 'normal', 90);
    }

    y += 5;
    doc.setDrawColor(200);
    if (y > H - M - 22) { doc.addPage('a4', 'portrait'); y = M; }
    doc.line(M, y, W - M, y); y += 6;
    line('This report was created by the driver using DingProof, a free browser tool. It is the driver’s own ' +
         'documentation of the vehicle at the time shown above. It is not an official document and it is not ' +
         'automatically binding on any rental company. All times are given in local time and in ISO 8601 UTC.',
         9, 'normal', 110);

    /* ---- Page 2: diagram ---- */
    diagramToPng(function (png) {
      doc.addPage('a4', 'portrait');
      y = M;
      line('Damage diagram', 15, 'bold'); y += 2;
      var diagramNote = state.pickup && state.pickup.marks.length
        ? 'Top view. Red pins are new marks from this inspection. Grey pins (P1, P2, …) are damage already recorded at pickup.'
        : 'Top view. Red pins are the spots the driver marked. ' + (state.marks.length ? 'Numbers match the list on page 1.' : 'No marks were added.');
      line(diagramNote, 10, 'normal', 100);
      y += 4;

      if (png) {
        var maxW = 104, maxH = H - y - M - 4;
        var ratioD = 1240 / 640;
        var w = maxW, h = w * ratioD;
        if (h > maxH) { h = maxH; w = h / ratioD; }
        try { doc.addImage(png, 'PNG', (W - w) / 2, y, w, h); }
        catch (e) { line('The diagram could not be drawn on this device. The list on page 1 still shows every mark.', 10, 'normal', 110); }
      } else {
        line('The diagram could not be drawn on this device. The list on page 1 still shows every mark.', 10, 'normal', 110);
      }

      // Landscape photo page: picture on the left, a details panel beside it.
      function photoPage(title, rows, p) {
        doc.addPage('a4', 'landscape');
        var PW = 297, PH = 210;
        var HEAD = 18, top = HEAD + 7, DETAIL_W = 66, GAP = 7;
        var imgW = PW - M * 2 - DETAIL_W - GAP;
        var imgH = PH - top - M;
        var detailX = M + imgW + GAP;

        doc.setFillColor(14, 17, 22);
        doc.rect(0, 0, PW, HEAD, 'F');
        doc.setFont('helvetica', 'bold'); doc.setFontSize(13); doc.setTextColor(255, 197, 49);
        doc.text('DingProof', M, 12);
        doc.setFont('courier', 'normal'); doc.setFontSize(9); doc.setTextColor(235);
        doc.text((tr.plate || 'NO PLATE') + '  ·  ' + tr.phase, PW - M, 12, { align: 'right' });

        var ratioP = p.height / p.width;
        var w = imgW, h = w * ratioP;
        if (h > imgH) { h = imgH; w = h / ratioP; }
        var ix = M + (imgW - w) / 2, iy = top + (imgH - h) / 2;
        try { doc.addImage(p.dataUrl, 'JPEG', ix, iy, w, h); }
        catch (e) {
          doc.setTextColor(120); doc.setFont('helvetica', 'normal'); doc.setFontSize(10);
          doc.text('This photo could not be added to the PDF.', M, top + 10);
        }

        var inner = DETAIL_W - 8;
        var titleLines = doc.splitTextToSize(title, inner);
        var blocks = [];
        var panelH = 6 + titleLines.length * 5.6 + 4;
        for (var r = 0; r < rows.length; r++) {
          var valLines = doc.splitTextToSize(String(rows[r][1]), inner);
          blocks.push(valLines);
          panelH += 4.4 + valLines.length * 4.2 + 3;
        }
        panelH += 3;

        doc.setFillColor(243, 245, 248); doc.setDrawColor(214, 220, 228);
        doc.roundedRect(detailX, top, DETAIL_W, panelH, 3, 3, 'FD');

        var dy = top + 8;
        doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor(20, 24, 31);
        for (var ti = 0; ti < titleLines.length; ti++) { doc.text(titleLines[ti], detailX + 4, dy); dy += 5.6; }
        dy += 1;
        doc.setDrawColor(206, 213, 222);
        doc.line(detailX + 4, dy, detailX + DETAIL_W - 4, dy); dy += 5;

        for (var k = 0; k < rows.length; k++) {
          doc.setFont('helvetica', 'bold'); doc.setFontSize(7.2); doc.setTextColor(118, 128, 142);
          doc.text(String(rows[k][0]).toUpperCase(), detailX + 4, dy); dy += 4.4;
          var mono = /plate|utc|local|position/i.test(rows[k][0]);
          doc.setFont(mono ? 'courier' : 'helvetica', 'normal'); doc.setFontSize(8.6); doc.setTextColor(28, 33, 41);
          for (var vi = 0; vi < blocks[k].length; vi++) { doc.text(blocks[k][vi], detailX + 4, dy); dy += 4.2; }
          dy += 3;
        }
      }

      /* ---- One page per damage close-up ---- */
      state.marks.forEach(function (m, i) {
        if (!m.photo) { return; }
        photoPage('Damage ' + (i + 1) + ' — ' + m.type, [
          ['Mark on diagram', 'Number ' + (i + 1)],
          ['Type of damage', m.type],
          ['Driver’s note', m.note || 'No note added'],
          ['Licence plate', tr.plate || 'Not given'],
          ['Inspection', tr.phase],
          ['Taken (local)', m.photo.takenAt.local],
          ['Taken (UTC)', m.photo.takenAt.iso]
        ], m.photo);
      });

      /* ---- One page per walk-around photo ---- */
      SHOTS.forEach(function (shot, i) {
        var p = state.photos[shot.key];
        if (!p) { return; }
        photoPage((i + 1) + '. ' + shot.name, [
          ['Position', (i + 1) + ' of ' + SHOTS.length],
          ['What this photo shows', SHOT_HOW_EN[i]],
          ['Licence plate', tr.plate || 'Not given'],
          ['Inspection', tr.phase],
          ['Taken (local)', p.takenAt.local],
          ['Taken (UTC)', p.takenAt.iso]
        ], p);
      });

      var name = 'DingProof_' + safePlate(tr.plate) + '_' + fileDateStr(now.date) + '.pdf';
      done(null, doc, name);
    });
  }

  /* ---------------------------------------------------------------
     Saving a file: normal download everywhere, except inside the
     claude.ai preview host, where pages cannot start a download
     directly and instead go through the viewer's own save prompt.
  --------------------------------------------------------------- */

  var __hostSavePromise = (window.claude && typeof window.claude.use === 'function')
    ? window.claude.use('downloads')['catch'](function () { return null; })
    : null;

  // data: string | Blob | ArrayBuffer. Resolves 'saved' or 'nohost'; rejects {code}.
  window.__dpHostSave = __hostSavePromise ? function (name, data) {
    return __hostSavePromise.then(function (dl) {
      if (!dl) { return 'nohost'; }
      return dl.save({ filename: name, data: data }).then(function () { return 'saved'; });
    });
  } : null;

  function downloadBlob(name, data, mime) {
    var blob = (data instanceof Blob) ? data : new Blob([data], { type: mime || 'application/octet-stream' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = name;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 4000);
  }

  /* ---------------------------------------------------------------
     Download the PDF
  --------------------------------------------------------------- */

  var lastPdfDoc = null, lastPdfName = null;

  $('#downloadBtn').addEventListener('click', function () {
    var btn = $('#downloadBtn');
    var status = $('#pdfStatus');
    status.className = 'pdf-status mono';
    status.textContent = t('st_build');
    btn.disabled = true;

    setTimeout(function () {
      buildPdf(function (err, doc, name) {
        btn.disabled = false;
        if (err) {
          status.className = 'pdf-status mono is-error';
          status.textContent = err.message;
          return;
        }
        lastPdfDoc = doc; lastPdfName = name;

        function localSave() {
          try {
            doc.save(name);
            status.className = 'pdf-status mono is-ok';
            status.textContent = t('st_saved', { name: name });
          } catch (e) {
            status.className = 'pdf-status mono is-error';
            status.textContent = t('st_savefail');
          }
        }
        if (!window.__dpHostSave) { localSave(); renderSummary(); return; }
        status.textContent = t('st_wait');
        window.__dpHostSave(name, doc.output('arraybuffer')).then(function (r) {
          if (r === 'nohost') { localSave(); return; }
          status.className = 'pdf-status mono is-ok';
          status.textContent = t('st_saved', { name: name });
        })['catch'](function (err2) {
          var code = (err2 && err2.code) || 'unavailable';
          status.className = 'pdf-status mono is-error';
          if (code === 'declined') { status.textContent = t('st_cancel'); }
          else if (code === 'too_large') { status.textContent = t('st_big'); }
          else if (code === 'rate_limited') { status.textContent = t('st_wait'); }
          else { localSave(); }
        });
        renderSummary();
      });
    }, 30);
  });

  /* ---------------------------------------------------------------
     Share the PDF (Web Share API, where present)
  --------------------------------------------------------------- */

  $('#shareBtn').addEventListener('click', function () {
    var status = $('#extraStatus');
    buildPdf(function (err, doc, name) {
      if (err) { status.classList.remove('is-on'); status.textContent = err.message; return; }
      try {
        var blob = doc.output('blob');
        var file = new File([blob], name, { type: 'application/pdf' });
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          navigator.share({ files: [file], title: 'DingProof' })['catch'](function () {});
        } else {
          downloadBlob(name, blob, 'application/pdf');
          status.classList.add('is-on');
          status.textContent = t('st_saved', { name: name });
        }
      } catch (e) {
        status.classList.remove('is-on');
        status.textContent = t('st_savefail');
      }
    });
  });

  /* ---------------------------------------------------------------
     Download the walk-around video as its own file
  --------------------------------------------------------------- */

  $('#videoDlBtn').addEventListener('click', function () {
    if (!state.video) { return; }
    var tr = trip();
    var name = 'DingProof_video_' + safePlate(tr.plate) + '_' + fileDateStr(new Date()) + '.' + state.video.ext;
    var status = $('#extraStatus');

    function localSave() {
      downloadBlob(name, state.video.blob, state.video.mime);
      status.classList.add('is-on');
      status.textContent = t('st_saved', { name: name });
    }
    if (!window.__dpHostSave) { localSave(); return; }
    if (state.video.size > MAX_VIDEO_BYTES) { localSave(); return; }
    window.__dpHostSave(name, state.video.blob).then(function (r) {
      if (r === 'nohost') { localSave(); return; }
      status.classList.add('is-on');
      status.textContent = t('st_saved', { name: name });
    })['catch'](function () { localSave(); });
  });

  /* ---------------------------------------------------------------
     Copy a ready-to-send dispute email (always in English on purpose:
     it is addressed to the rental company, wherever they are)
  --------------------------------------------------------------- */

  $('#disputeBtn').addEventListener('click', function () {
    var tr = trip();
    var now = stamp();
    var name = 'DingProof_' + safePlate(tr.plate) + '_' + fileDateStr(now.date) + '.pdf';
    var lines = [
      'Subject: Vehicle condition report — ' + (tr.plate || 'licence plate on file'),
      '',
      'Hello,',
      '',
      'I am writing regarding the rental of a ' + (tr.model || 'vehicle') +
        (tr.plate ? ' (plate ' + tr.plate + ')' : '') + (tr.company ? ' from ' + tr.company : '') + '.',
      '',
      'Attached is my own condition report, DingProof, created on my phone at ' + tr.phase.toLowerCase() +
        ' (' + now.local + ', ' + now.iso + ' UTC). It includes ' + photoCount() + ' timestamped photos of the ' +
        'vehicle' + (state.marks.length ? ' and ' + state.marks.length + ' marked point(s) of existing damage' : '') +
        (state.video ? ', plus a short walk-around video' : '') + '.',
      '',
      'Please treat this as my documented record of the vehicle\'s condition at ' + tr.phase.toLowerCase() +
        '. I would appreciate it if any damage charge were reviewed against this report before being applied.',
      '',
      'Report file: ' + name,
      '',
      'Thank you,'
    ];
    var text = lines.join('\n');
    var status = $('#extraStatus');

    function ok() { status.classList.add('is-on'); status.textContent = t('copied'); }
    function fail() { status.classList.remove('is-on'); status.textContent = t('copy_fail'); }

    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(ok)['catch'](fail);
    } else {
      try {
        var ta = document.createElement('textarea');
        ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
        document.body.appendChild(ta); ta.focus(); ta.select();
        var worked = document.execCommand('copy');
        document.body.removeChild(ta);
        worked ? ok() : fail();
      } catch (e) { fail(); }
    }
  });

  /* ---------------------------------------------------------------
     Reset and unload warning
  --------------------------------------------------------------- */

  $('#resetBtn').addEventListener('click', function () {
    if (hasData() && !window.confirm(t('reset_confirm'))) { return; }
    state.photos = {};
    state.marks = [];
    state.geo = null;
    state.geoAsked = false;
    state.pickup = null;
    if (state.video && state.video.url) { URL.revokeObjectURL(state.video.url); }
    state.video = null;
    $('#tripForm').reset();
    $('#compareStatus').textContent = '';
    $('#compareStatus').classList.remove('is-on');
    updateCompareVisibility();
    $('#geoBtn').disabled = false;
    $('#geoBtn').textContent = t('geo_btn');
    setGeoStatus(t('geo_none'), false);
    buildShotList();
    updateShotCount();
    renderMarks();
    renderVideoUI();
    $('#pdfStatus').textContent = '';
    $('#pdfStatus').className = 'pdf-status mono';
    $('#extraStatus').textContent = '';
    $('#extraStatus').classList.remove('is-on');
    goto(1);
  });

  window.addEventListener('beforeunload', function (ev) {
    if (!hasData()) { return; }
    ev.preventDefault();
    ev.returnValue = '';
    return '';
  });

  /* ---------------------------------------------------------------
     Offline app shell + "Add to home screen"
  --------------------------------------------------------------- */

  // Registering the service worker only helps on the real deployed origin
  // (GitHub Pages, Vercel, …). It quietly no-ops on file:// and inside a
  // sandboxed preview frame, both of which refuse service workers anyway.
  if ('serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js')['catch'](function () {});
    });
  }

  var deferredInstallPrompt = null;
  window.addEventListener('beforeinstallprompt', function (ev) {
    ev.preventDefault();
    deferredInstallPrompt = ev;
    $('#installBar').classList.remove('is-hidden');
  });

  $('#installBtn').addEventListener('click', function () {
    if (!deferredInstallPrompt) { return; }
    deferredInstallPrompt.prompt();
    deferredInstallPrompt.userChoice['finally'](function () {
      deferredInstallPrompt = null;
      $('#installBar').classList.add('is-hidden');
    });
  });

  $('#installDismiss').addEventListener('click', function () {
    $('#installBar').classList.add('is-hidden');
  });

  window.addEventListener('appinstalled', function () {
    $('#installBar').classList.add('is-hidden');
  });

  /* ---------------------------------------------------------------
     Start
  --------------------------------------------------------------- */

  updateCompareVisibility();
  applyTranslations();
  goto(1);
})();
