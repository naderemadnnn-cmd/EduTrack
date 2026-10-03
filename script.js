"use strict";

/* =========================================================
   EduTrack - Main JavaScript
   الإصدار المعدل
   ========================================================= */

const STORAGE_KEY = "EDUTRACK_PLATFORM_V5";


/* =========================================================
   IndexedDB - تخزين الملفات الكبيرة
   localStorage لها حد 5MB فقط
   IndexedDB تدعم مئات الميجابايت
   ========================================================= */

const IDB_NAME = "EDUTRACK_FILES_DB";
const IDB_STORE = "files";


function openFileDB() {

    return new Promise(
        (resolve, reject) => {

            const request =
                indexedDB.open(
                    IDB_NAME,
                    1
                );


            request.onupgradeneeded =
                (e) => {

                    const idb =
                        e.target.result;

                    if (
                        !idb.objectStoreNames
                            .contains(IDB_STORE)
                    ) {

                        idb.createObjectStore(
                            IDB_STORE
                        );

                    }

                };


            request.onsuccess =
                (e) => {

                    resolve(
                        e.target.result
                    );

                };


            request.onerror =
                (e) => {

                    reject(
                        e.target.error
                    );

                };

        }
    );

}


function saveFileToIDB(
    id,
    dataURL
) {

    return openFileDB()
        .then(idb => {

            return new Promise(
                (resolve, reject) => {

                    const tx =
                        idb.transaction(
                            IDB_STORE,
                            "readwrite"
                        );


                    tx.objectStore(
                        IDB_STORE
                    ).put(
                        dataURL,
                        id
                    );


                    tx.oncomplete =
                        () => resolve();


                    tx.onerror =
                        (e) => reject(
                            e.target.error
                        );

                }
            );

        });

}


function deleteFileFromIDB(
    id
) {

    return openFileDB()
        .then(idb => {

            return new Promise(
                (resolve, reject) => {

                    const tx =
                        idb.transaction(
                            IDB_STORE,
                            "readwrite"
                        );


                    tx.objectStore(
                        IDB_STORE
                    ).delete(id);


                    tx.oncomplete =
                        () => resolve();


                    tx.onerror =
                        (e) => reject(
                            e.target.error
                        );

                }
            );

        });

}


function clearAllFilesFromIDB() {

    return openFileDB()
        .then(idb => {

            return new Promise(
                (resolve, reject) => {

                    const tx =
                        idb.transaction(
                            IDB_STORE,
                            "readwrite"
                        );


                    tx.objectStore(
                        IDB_STORE
                    ).clear();


                    tx.oncomplete =
                        () => resolve();


                    tx.onerror =
                        (e) => reject(
                            e.target.error
                        );

                }
            );

        });

}


function getAllFilesFromIDB() {

    return openFileDB()
        .then(idb => {

            return new Promise(
                (resolve, reject) => {

                    const tx =
                        idb.transaction(
                            IDB_STORE,
                            "readonly"
                        );


                    const store =
                        tx.objectStore(
                            IDB_STORE
                        );


                    const result = {};


                    const cursorReq =
                        store.openCursor();


                    cursorReq.onsuccess =
                        (e) => {

                            const cursor =
                                e.target.result;

                            if (cursor) {

                                result[
                                    cursor.key
                                ] = cursor.value;

                                cursor.continue();

                            } else {

                                resolve(result);

                            }

                        };


                    cursorReq.onerror =
                        (e) => reject(
                            e.target.error
                        );

                }
            );

        });

}

/* كلمة سر المدرس */
const TEACHER_PASSWORD = "EduTrack1300854";

/* =========================================================
   GRADES
   ========================================================= */

const GRADES = {
    prep1: "أولى إعدادي",
    prep2: "تانية إعدادي",
    prep3: "تالتة إعدادي",
    secondary1: "أولى ثانوي",
    secondary2: "تانية ثانوي",
    secondary3: "تالتة ثانوي"
};


/* =========================================================
   CURRENT SESSION
   ========================================================= */

let currentRole = null;

let currentUser = null;

let currentGrade = null;


/* =========================================================
   DATABASE
   ========================================================= */

let db = {
    students: [],
    contents: []
};


/* =========================================================
   START
   ========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    init
);


function init() {

    loadData();

    bindRoleButtons();

    bindGradeButtons();

    bindNavigation();

    bindGlobalButtons();

    bindStudentActions();

    bindContentActions();

    showRoleScreen();

}


/* =========================================================
   DATABASE
   ========================================================= */

function loadData() {

    try {

        const saved =
            localStorage.getItem(
                STORAGE_KEY
            );

        if (!saved) {

            return;

        }

        const parsed =
            JSON.parse(saved);


        db = {

            students:
                Array.isArray(parsed.students)
                    ? parsed.students
                    : [],

            contents:
                Array.isArray(parsed.contents)
                    ? parsed.contents
                    : []

        };


        /*
         * توافق مع البيانات القديمة
         */

        db.students =
            db.students.map(student => ({

                ...student,

                grade:
                    student.grade ||
                    "prep1"

            }));


        db.contents =
            db.contents.map(content => ({

                ...content,

                grade:
                    content.grade ||
                    "prep1"

            }));


        /*
         * تحميل ملفات الـ dataURL من IndexedDB
         * (غير متزامن - يتم في الخلفية)
         */

        loadFileDataFromIDB();


    } catch (error) {

        console.error(
            "Database loading error:",
            error
        );


        db = {

            students: [],

            contents: []

        };

    }

}


/* =========================================================
   LOAD FILE DATA FROM INDEXEDDB
   ========================================================= */

function loadFileDataFromIDB() {

    getAllFilesFromIDB()
        .then(files => {

            let updated = false;


            db.contents.forEach(
                content => {

                    if (
                        files[content.id]
                    ) {

                        content.dataURL =
                            files[
                                content.id
                            ];

                        updated = true;

                    }

                }
            );


            if (updated) {

                try {

                    renderContents();

                } catch (e) {
                    /* الشاشة قد لا تكون مفتوحة بعد */
                }

            }

        })
        .catch(err => {

            console.error(
                "IDB load error:",
                err
            );

        });

}


/* =========================================================
   SAVE DATABASE
   ========================================================= */

function saveData() {

    try {

        /*
         * حفظ ملفات dataURL في IndexedDB
         * وحذفها من نسخة localStorage
         * لتفادي تجاوز حد الـ 5MB
         */

        const contentsForStorage =
            db.contents.map(c => {

                if (c.dataURL) {

                    const {
                        dataURL,
                        ...rest
                    } = c;


                    saveFileToIDB(
                        c.id,
                        dataURL
                    ).catch(err => {

                        console.error(
                            "IDB save error:",
                            c.id,
                            err
                        );

                    });


                    return rest;

                }

                return c;

            });


        const dataForStorage = {

            students:
                db.students,

            contents:
                contentsForStorage

        };


        localStorage.setItem(
            STORAGE_KEY,
            JSON.stringify(
                dataForStorage
            )
        );

    } catch (error) {

        console.error(
            "Database saving error:",
            error
        );


        alert(
            "تعذر حفظ البيانات. مساحة التخزين في المتصفح قد تكون ممتلئة."
        );

    }

}


/* =========================================================
   HELPERS
   ========================================================= */

function $(id) {

    return document.getElementById(id);

}


function escapeHTML(value) {

    return String(value ?? "")

        .replaceAll(
            "&",
            "&amp;"
        )

        .replaceAll(
            "<",
            "&lt;"
        )

        .replaceAll(
            ">",
            "&gt;"
        )

        .replaceAll(
            '"',
            "&quot;"
        )

        .replaceAll(
            "'",
            "&#039;"
        );

}


function escapeAttribute(value) {

    return escapeHTML(value);

}


/* =========================================================
   GRADE NAME
   ========================================================= */

function gradeName(grade) {

    return (
        GRADES[grade] ||
        "الصف غير محدد"
    );

}


/* =========================================================
   ROLE BUTTONS
   ========================================================= */

function bindRoleButtons() {

    document
        .querySelectorAll(
            "[data-role]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    selectRole(
                        button.dataset.role
                    );

                }
            );

        });

}


/* =========================================================
   SELECT ROLE
   ========================================================= */

function selectRole(role) {

    if (

        role !== "student" &&

        role !== "teacher" &&

        role !== "supervisor"

    ) {

        return;

    }


    currentRole = role;

    currentUser = null;

    currentGrade = null;


    showGradeScreen();

}


/* =========================================================
   GRADE BUTTONS
   ========================================================= */

function bindGradeButtons() {

    document
        .querySelectorAll(
            "[data-grade]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    selectGrade(
                        button.dataset.grade
                    );

                }
            );

        });


    $("backFromGrade")
        ?.addEventListener(
            "click",
            showRoleScreen
        );


    $("backFromTeacherPassword")
        ?.addEventListener(
            "click",
            showGradeScreen
        );


    $("teacherLoginButton")
        ?.addEventListener(
            "click",
            teacherPasswordLogin
        );


    $("teacherPassword")
        ?.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter"
                ) {

                    teacherPasswordLogin();

                }

            }
        );

}


/* =========================================================
   SHOW GRADE SCREEN
   ========================================================= */

function showGradeScreen() {

    $("roleScreen")
        ?.classList.add(
            "hidden"
        );


    $("teacherPasswordScreen")
        ?.classList.add(
            "hidden"
        );


    $("app")
        ?.classList.add(
            "hidden"
        );


    const screen =
        $("gradeScreen");


    if (!screen) {

        /*
         * لو شاشة الصف غير موجودة في HTML
         * نعرضها تلقائيًا.
         */

        createGradeScreen();

        return;

    }


    screen.classList.remove(
        "hidden"
    );


    const description =
        $("gradeDescription");


    if (description) {

        const roleText = {

            student:
                "اختر الصف الدراسي أولًا ثم أدخل بيانات الطالب.",

            teacher:
                "اختر الصف الذي ستعمل عليه ثم أدخل كلمة مرور المعلم.",

            supervisor:
                "اختر الصف الذي تريد متابعته ثم ادخل إلى التقارير والمتابعة."

        };


        description.textContent =
            roleText[currentRole] ||
            "اختر الصف الدراسي للمتابعة";

    }


    bindGradeButtons();

}


/* =========================================================
   CREATE GRADE SCREEN IF MISSING
   ========================================================= */

function createGradeScreen() {

    let screen =
        $("gradeScreen");


    if (screen) {

        screen.classList.remove(
            "hidden"
        );

        bindGradeButtons();

        return;

    }


    screen =
        document.createElement(
            "section"
        );


    screen.id =
        "gradeScreen";


    screen.innerHTML = `

        <div class="role-container">

            <div class="logo">
                E
            </div>

            <h1>
                اختيار الصف الدراسي
            </h1>

            <p id="gradeDescription">
                اختر الصف الدراسي للمتابعة
            </p>

            <div class="role-grid">

                <button
                    type="button"
                    class="role-card"
                    data-grade="prep1"
                >

                    <span class="role-icon">
                        1️⃣
                    </span>

                    <strong>
                        أولى إعدادي
                    </strong>

                    <small>
                        الصف الأول الإعدادي
                    </small>

                </button>


                <button
                    type="button"
                    class="role-card"
                    data-grade="prep2"
                >

                    <span class="role-icon">
                        2️⃣
                    </span>

                    <strong>
                        تانية إعدادي
                    </strong>

                    <small>
                        الصف الثاني الإعدادي
                    </small>

                </button>


                <button
                    type="button"
                    class="role-card"
                    data-grade="prep3"
                >

                    <span class="role-icon">
                        3️⃣
                    </span>

                    <strong>
                        تالتة إعدادي
                    </strong>

                    <small>
                        الصف الثالث الإعدادي
                    </small>

                </button>


                <button
                    type="button"
                    class="role-card"
                    data-grade="secondary1"
                >

                    <span class="role-icon">
                        1️⃣
                    </span>

                    <strong>
                        أولى ثانوي
                    </strong>

                    <small>
                        الصف الأول الثانوي
                    </small>

                </button>


                <button
                    type="button"
                    class="role-card"
                    data-grade="secondary2"
                >

                    <span class="role-icon">
                        2️⃣
                    </span>

                    <strong>
                        تانية ثانوي
                    </strong>

                    <small>
                        الصف الثاني الثانوي
                    </small>

                </button>


                <button
                    type="button"
                    class="role-card"
                    data-grade="secondary3"
                >

                    <span class="role-icon">
                        3️⃣
                    </span>

                    <strong>
                        تالتة ثانوي
                    </strong>

                    <small>
                        الصف الثالث الثانوي
                    </small>

                </button>

            </div>


            <button
                id="backFromGrade"
                class="secondary"
                type="button"
                style="margin-top:25px;"
            >
                ← العودة لاختيار المستخدم
            </button>

        </div>

    `;


    document.body.prepend(
        screen
    );


    screen.classList.remove(
        "hidden"
    );


    bindGradeButtons();

}


/* =========================================================
   SELECT GRADE
   ========================================================= */

function selectGrade(grade) {

    if (
        !GRADES[grade] ||
        !currentRole
    ) {

        return;

    }


    currentGrade =
        grade;


    /*
     * الطالب
     */

    if (
        currentRole === "student"
    ) {

        showStudentLogin();

        return;

    }


    /*
     * المدرس
     */

    if (
        currentRole === "teacher"
    ) {

        showTeacherPassword();

        return;

    }


    /*
     * المشرف
     */

    if (
        currentRole === "supervisor"
    ) {

        loginSupervisor();

    }

}


/* =========================================================
   TEACHER PASSWORD SCREEN
   ========================================================= */

function showTeacherPassword() {

    $("gradeScreen")
        ?.classList.add(
            "hidden"
        );


    let screen =
        $("teacherPasswordScreen");


    /*
     * لو الشاشة غير موجودة في HTML
     * يتم إنشاؤها تلقائيًا.
     */

    if (!screen) {

        createTeacherPasswordScreen();

        return;

    }


    screen.classList.remove(
        "hidden"
    );


    const gradeInput =
        $("selectedTeacherGrade");


    if (gradeInput) {

        gradeInput.value =
            gradeName(
                currentGrade
            );

    }


    const password =
        $("teacherPassword");


    const error =
        $("teacherLoginError");


    if (password) {

        password.value = "";

        setTimeout(
            () => password.focus(),
            50
        );

    }


    if (error) {

        error.textContent = "";

    }

}


/* =========================================================
   CREATE TEACHER PASSWORD SCREEN
   ========================================================= */

function createTeacherPasswordScreen() {

    const screen =
        document.createElement(
            "section"
        );


    screen.id =
        "teacherPasswordScreen";


    screen.innerHTML = `

        <div class="role-container">

            <div class="logo">
                E
            </div>

            <h1>
                دخول المعلم
            </h1>

            <p>
                الصف المختار:
                <strong id="selectedTeacherGrade">
                    ${escapeHTML(
                        gradeName(
                            currentGrade
                        )
                    )}
                </strong>
            </p>


            <div class="card">

                <div class="form-group">

                    <label>
                        كلمة مرور المعلم
                    </label>

                    <input
                        id="teacherPassword"
                        class="input"
                        type="password"
                        placeholder="أدخل كلمة المرور"
                        autocomplete="current-password"
                    >

                </div>


                <button
                    id="teacherLoginButton"
                    class="primary"
                    type="button"
                >
                    دخول
                </button>


                <button
                    id="backFromTeacherPassword"
                    class="secondary"
                    type="button"
                    style="width:100%;margin-top:10px;"
                >
                    ← تغيير الصف
                </button>


                <div
                    id="teacherLoginError"
                    class="login-error"
                ></div>

            </div>

        </div>

    `;


    document.body.prepend(
        screen
    );


    screen.classList.remove(
        "hidden"
    );


    bindGradeButtons();

}


/* =========================================================
   TEACHER PASSWORD LOGIN
   ========================================================= */

function teacherPasswordLogin() {

    const password =
        $("teacherPassword")
            ?.value ||
        "";


    const error =
        $("teacherLoginError");


    if (
        password !==
        TEACHER_PASSWORD
    ) {

        if (error) {

            error.textContent =
                "كلمة السر غير صحيحة.";

        }

        return;

    }


    loginTeacher();

}


/* =========================================================
   ROLE SCREEN
   ========================================================= */

function showRoleScreen() {

    $("gradeScreen")
        ?.classList.add(
            "hidden"
        );


    $("teacherPasswordScreen")
        ?.classList.add(
            "hidden"
        );


    const roleScreen =
        $("roleScreen");


    const app =
        $("app");


    if (roleScreen) {

        roleScreen.classList.remove(
            "hidden"
        );


        roleScreen.innerHTML = `

            <div class="role-container">

                <div class="logo">
                    E
                </div>


                <h1>
                    EduTrack
                </h1>


                <p>
                    المنصة التعليمية الذكية
                </p>


                <div class="role-grid">

                    <button
                        type="button"
                        class="role-card"
                        data-role="student"
                    >

                        <span class="role-icon">
                            🎓
                        </span>

                        <strong>
                            طالب
                        </strong>

                        <small>
                            الدخول إلى حساب الطالب
                        </small>

                    </button>


                    <button
                        type="button"
                        class="role-card"
                        data-role="teacher"
                    >

                        <span class="role-icon">
                            👨‍🏫
                        </span>

                        <strong>
                            مدرس
                        </strong>

                        <small>
                            إدارة الطلاب والمحتوى
                        </small>

                    </button>


                    <button
                        type="button"
                        class="role-card"
                        data-role="supervisor"
                    >

                        <span class="role-icon">
                            👁️
                        </span>

                        <strong>
                            مشرف
                        </strong>

                        <small>
                            التقارير والمتابعة فقط
                        </small>

                    </button>

                </div>

            </div>

        `;


        bindRoleButtons();

    }


    if (app) {

        app.classList.add(
            "hidden"
        );

    }


    currentRole = null;

    currentUser = null;

    currentGrade = null;

}


/* =========================================================
   STUDENT LOGIN
   ========================================================= */

function showStudentLogin() {

    $("gradeScreen")
        ?.classList.add(
            "hidden"
        );


    $("teacherPasswordScreen")
        ?.classList.add(
            "hidden"
        );


    const roleScreen =
        $("roleScreen");


    if (!roleScreen) {

        alert(
            "لم يتم العثور على شاشة الدخول."
        );

        return;

    }


    roleScreen.classList.remove(
        "hidden"
    );


    roleScreen.innerHTML = `

        <div class="role-container">

            <div class="logo">
                E
            </div>


            <h1>
                تسجيل دخول الطالب
            </h1>


            <p>

                الصف المختار:
                <strong>
                    ${escapeHTML(
                        gradeName(
                            currentGrade
                        )
                    )}
                </strong>

            </p>


            <div class="card login-card">

                <div class="form-group">

                    <label>
                        Student ID
                    </label>

                    <input
                        id="studentLoginID"
                        class="input"
                        type="text"
                        placeholder="STU123456"
                        autocomplete="username"
                    >

                </div>


                <div class="form-group">

                    <label>
                        الرقم السري
                    </label>

                    <input
                        id="studentLoginPassword"
                        class="input"
                        type="password"
                        placeholder="الرقم السري"
                        autocomplete="current-password"
                    >

                </div>


                <button
                    id="studentLoginButton"
                    class="primary"
                    type="button"
                >
                    دخول
                </button>


                <button
                    id="backToGrade"
                    class="secondary"
                    type="button"
                    style="width:100%;margin-top:10px;"
                >
                    ← تغيير الصف
                </button>


                <div
                    id="studentLoginError"
                    class="login-error"
                ></div>

            </div>

        </div>

    `;


    $("studentLoginButton")
        ?.addEventListener(
            "click",
            studentLogin
        );


    $("backToGrade")
        ?.addEventListener(
            "click",
            showGradeScreen
        );


    $("studentLoginPassword")
        ?.addEventListener(
            "keydown",
            event => {

                if (
                    event.key === "Enter"
                ) {

                    studentLogin();

                }

            }
        );

}


/* =========================================================
   STUDENT LOGIN
   ========================================================= */

function studentLogin() {

    const rawId =
        $("studentLoginID")
            ?.value
            .trim()
            .toUpperCase();


    /*
     * قبول الـ ID مع أو بدون STU
     * مثلاً: 849201 أو STU849201
     */

    const id =
        rawId.startsWith("STU")
            ? rawId
            : "STU" + rawId;


    const password =
        $("studentLoginPassword")
            ?.value
            .trim();


    const error =
        $("studentLoginError");


    if (
        !id ||
        !password
    ) {

        if (error) {

            error.textContent =
                "أدخل ID والرقم السري.";

        }

        return;

    }


    const student =
        db.students.find(
            item =>

                String(
                    item.id
                )
                    .toUpperCase() ===
                id &&

                String(
                    item.password
                ) ===
                password &&

                String(
                    item.grade || ""
                ) ===
                String(
                    currentGrade
                )
        );


    if (!student) {

        if (error) {

            error.textContent =
                "الـ ID أو الرقم السري غير صحيح أو الطالب ليس في هذا الصف.";

        }

        return;

    }


    currentRole =
        "student";


    currentUser =
        student;


    openApplication();

}


/* =========================================================
   TEACHER LOGIN
   ========================================================= */

function loginTeacher() {

    currentRole =
        "teacher";


    currentUser = {

        name: "المدرس",

        role: "teacher",

        grade:
            currentGrade

    };


    $("teacherPasswordScreen")
        ?.classList.add(
            "hidden"
        );


    openApplication();

}


/* =========================================================
   SUPERVISOR LOGIN
   ========================================================= */

function loginSupervisor() {

    currentRole =
        "supervisor";


    currentUser = {

        name: "المشرف",

        role: "supervisor",

        grade:
            currentGrade

    };


    $("gradeScreen")
        ?.classList.add(
            "hidden"
        );


    openApplication();

}


/* =========================================================
   OPEN APPLICATION
   ========================================================= */

function openApplication() {

    const roleScreen =
        $("roleScreen");


    const gradeScreen =
        $("gradeScreen");


    const teacherPasswordScreen =
        $("teacherPasswordScreen");


    const app =
        $("app");


    if (roleScreen) {

        roleScreen.classList.add(
            "hidden"
        );

    }


    if (gradeScreen) {

        gradeScreen.classList.add(
            "hidden"
        );

    }


    if (teacherPasswordScreen) {

        teacherPasswordScreen.classList.add(
            "hidden"
        );

    }


    if (app) {

        app.classList.remove(
            "hidden"
        );

    }


    updateUserInformation();

    applyPermissions();

    openPage(
        "dashboard"
    );

}


/* =========================================================
   USER INFORMATION
   ========================================================= */

function updateUserInformation() {

    let name =
        "المستخدم";


    let role =
        "";


    if (
        currentRole ===
        "student"
    ) {

        name =
            currentUser?.name ||
            "الطالب";

        role =
            "طالب";

    }


    if (
        currentRole ===
        "teacher"
    ) {

        name =
            "المدرس";

        role =
            "مدرس - صلاحيات كاملة";

    }


    if (
        currentRole ===
        "supervisor"
    ) {

        name =
            "المشرف";

        role =
            "مشرف - تقارير ومتابعة فقط";

    }


    const profileName =
        $("profileName");


    const profileRole =
        $("profileRole");


    const avatar =
        $("avatar");


    const headerAvatar =
        $("headerAvatar");


    if (profileName) {

        profileName.textContent =
            name;

    }


    if (profileRole) {

        profileRole.textContent =
            role;

    }


    if (avatar) {

        avatar.textContent =
            name.charAt(0);

    }


    if (headerAvatar) {

        headerAvatar.textContent =
            name.charAt(0);

    }


    const profileGrade =
        $("profileGrade");


    const currentGradeName =
        $("currentGradeName");


    if (profileGrade) {

        profileGrade.textContent =
            gradeName(
                currentGrade
            );

    }


    if (currentGradeName) {

        currentGradeName.textContent =
            gradeName(
                currentGrade
            );

    }

}


/* =========================================================
   PERMISSIONS
   ========================================================= */

function hasPermission(
    permission
) {

    const permissions = {

        student: {

            management:
                false,

            upload:
                false,

            content:
                true,

            delete:
                false,

            reports:
                false

        },


        teacher: {

            management:
                true,

            upload:
                true,

            content:
                true,

            delete:
                true,

            reports:
                true

        },


        supervisor: {

            management:
                false,

            upload:
                false,

            content:
                false,

            delete:
                false,

            reports:
                true

        }

    };


    return Boolean(

        permissions[
            currentRole
        ]?.[
            permission
        ]

    );

}


/* =========================================================
   APPLY PERMISSIONS
   ========================================================= */

function applyPermissions() {

    /*
     * أزرار الصلاحيات
     */

    document
        .querySelectorAll(
            "[data-permission]"
        )
        .forEach(
            element => {

                const permission =
                    element.dataset.permission;


                element.style.display =
                    hasPermission(
                        permission
                    )
                        ? ""
                        : "none";

            }
        );


    const addStudent =
        $("addStudent");


    const uploadArea =
        $("uploadArea");


    const readonlyBanner =
        $("readonlyBanner");


    if (addStudent) {

        addStudent.style.display =
            hasPermission(
                "management"
            )
                ? ""
                : "none";

    }


    if (uploadArea) {

        uploadArea.style.display =
            hasPermission(
                "upload"
            )
                ? ""
                : "none";

    }


    if (readonlyBanner) {

        readonlyBanner.style.display =
            currentRole ===
            "supervisor"
                ? ""
                : "none";

    }

}


/* =========================================================
   NAVIGATION
   ========================================================= */

function bindNavigation() {

    document
        .querySelectorAll(
            "[data-page]"
        )
        .forEach(button => {

            button.addEventListener(
                "click",
                () => {

                    openPage(
                        button.dataset.page
                    );

                }
            );

        });

}


/* =========================================================
   OPEN PAGE
   ========================================================= */

function openPage(page) {

    const pages = [

        "dashboard",

        "students",

        "content",

        "reports"

    ];


    if (
        !pages.includes(page)
    ) {

        return;

    }


    /*
     * الطالب لا يرى صفحة الطلاب
     */

    if (

        currentRole ===
        "student" &&

        page ===
        "students"

    ) {

        page =
            "dashboard";

    }


    /*
     * المشرف لا يرى المحتوى
     */

    if (

        currentRole ===
        "supervisor" &&

        page ===
        "content"

    ) {

        page =
            "reports";

    }


    /*
     * الطالب لا يرى التقارير
     */

    if (

        currentRole ===
        "student" &&

        page ===
        "reports"

    ) {

        page =
            "dashboard";

    }


    document
        .querySelectorAll(
            ".page"
        )
        .forEach(section => {

            section.classList.add(
                "hidden"
            );

        });


    const target =
        $(page + "Page");


    if (target) {

        target.classList.remove(
            "hidden"
        );

    }


    document
        .querySelectorAll(
            "[data-page]"
        )
        .forEach(button => {

            button.classList.toggle(

                "active",

                button.dataset.page ===
                page

            );

        });


    updatePageTitle(
        page
    );


    if (
        page ===
        "dashboard"
    ) {

        renderDashboard();

    }


    if (
        page ===
        "students"
    ) {

        renderStudents();

    }


    if (
        page ===
        "content"
    ) {

        renderContents();

    }


    if (
        page ===
        "reports"
    ) {

        renderReports();

    }

}


/* =========================================================
   PAGE TITLES
   ========================================================= */

function updatePageTitle(page) {

    const titles = {

        dashboard: {

            title:
                "لوحة التحكم",

            description:
                "متابعة أداء الطلاب وإدارة المنصة"

        },


        students: {

            title:
                "متابعة الطلاب",

            description:
                "إدارة ومتابعة مستوى الطلاب"

        },


        content: {

            title:
                "المحتوى التعليمي",

            description:
                "الصور والفيديوهات والملفات التعليمية"

        },


        reports: {

            title:
                "التقارير",

            description:
                "تقارير ومؤشرات أداء الطلاب"

        }

    };


    const data =
        titles[page] ||
        titles.dashboard;


    const title =
        $("pageTitle");


    const description =
        $("pageDescription");


    if (title) {

        title.textContent =
            data.title;

    }


    if (description) {

        description.textContent =
            data.description;

    }

}


/* =========================================================
   FILTER STUDENTS BY GRADE
   ========================================================= */

function studentsForCurrentGrade() {

    return db.students.filter(
        student =>

            String(
                student.grade ||
                ""
            ) ===

            String(
                currentGrade
            )
    );

}


/* =========================================================
   FILTER CONTENT BY GRADE
   ========================================================= */

function contentsForCurrentGrade() {

    return db.contents.filter(
        content =>

            String(
                content.grade ||
                ""
            ) ===

            String(
                currentGrade
            )
    );

}


/* =========================================================
   DASHBOARD
   ========================================================= */

function renderDashboard() {

    const page =
        $("dashboardPage");


    if (!page) {

        return;

    }


    /*
     * الطالب
     */

    if (
        currentRole ===
        "student"
    ) {

        renderStudentDashboard(
            page
        );

        return;

    }


    /*
     * بيانات الصف الحالي
     */

    const students =
        studentsForCurrentGrade();


    const total =
        students.length;


    const average =
        total

            ? Math.round(

                students.reduce(

                    (sum, student) =>

                        sum +
                        Number(
                            student.current ||
                            0
                        ),

                    0

                ) / total

            )

            : 0;


    const improving =
        students.filter(

            student =>

                Number(
                    student.current ||
                    0
                ) >

                Number(
                    student.previous ||
                    0
                )

        ).length;


    const declining =
        students.filter(

            student =>

                Number(
                    student.current ||
                    0
                ) <

                Number(
                    student.previous ||
                    0
                )

        ).length;


    page.innerHTML = `

        <div class="page-header">

            <div>

                <h2>
                    لوحة التحكم
                </h2>

                <p>
                    ${escapeHTML(
                        gradeName(
                            currentGrade
                        )
                    )}
                </p>

            </div>

        </div>


        <div class="stats">

            <div class="card stat-card">

                <div class="stat-icon">
                    👨‍🎓
                </div>

                <div>

                    <span>
                        طلاب الصف
                    </span>

                    <strong>
                        ${total}
                    </strong>

                </div>

            </div>


            <div class="card stat-card">

                <div class="stat-icon">
                    📊
                </div>

                <div>

                    <span>
                        متوسط المستوى
                    </span>

                    <strong>
                        ${average}%
                    </strong>

                </div>

            </div>


            <div class="card stat-card">

                <div class="stat-icon">
                    📈
                </div>

                <div>

                    <span>
                        تحسن
                    </span>

                    <strong>
                        ${improving}
                    </strong>

                </div>

            </div>


            <div class="card stat-card">

                <div class="stat-icon">
                    📉
                </div>

                <div>

                    <span>
                        يحتاج متابعة
                    </span>

                    <strong>
                        ${declining}
                    </strong>

                </div>

            </div>

        </div>


        <div class="card">

            <h3>
                أداء طلاب
                ${escapeHTML(
                    gradeName(
                        currentGrade
                    )
                )}
            </h3>


            <div
                id="performanceList"
                class="performance-list"
            ></div>

        </div>

    `;


    renderPerformanceList();

}


/* =========================================================
   STUDENT DASHBOARD
   ========================================================= */

function renderStudentDashboard(
    page
) {

    const current =
        Number(
            currentUser?.current ||
            0
        );


    const previous =
        Number(
            currentUser?.previous ||
            0
        );


    const difference =
        current -
        previous;


    let trend =
        "→ ثابت";


    if (
        difference > 0
    ) {

        trend =
            `↑ +${difference}%`;

    }


    if (
        difference < 0
    ) {

        trend =
            `↓ ${difference}%`;

    }


    const studentContents =
        contentsForCurrentGrade();


    page.innerHTML = `

        <div class="page-header">

            <div>

                <h2>
                    مرحبًا
                    ${escapeHTML(
                        currentUser?.name ||
                        "الطالب"
                    )}
                </h2>

                <p>
                    ${escapeHTML(
                        gradeName(
                            currentGrade
                        )
                    )}
                </p>

            </div>

        </div>


        <div class="stats">

            <div class="card stat-card">

                <div class="stat-icon">
                    🎓
                </div>

                <div>

                    <span>
                        الطالب
                    </span>

                    <strong>
                        ${escapeHTML(
                            currentUser?.name ||
                            "الطالب"
                        )}
                    </strong>

                </div>

            </div>


            <div class="card stat-card">

                <div class="stat-icon">
                    🆔
                </div>

                <div>

                    <span>
                        Student ID
                    </span>

                    <strong>
                        ${escapeHTML(
                            currentUser?.id ||
                            "-"
                        )}
                    </strong>

                </div>

            </div>


            <div class="card stat-card">

                <div class="stat-icon">
                    📊
                </div>

                <div>

                    <span>
                        المستوى الحالي
                    </span>

                    <strong>
                        ${current}%
                    </strong>

                </div>

            </div>


            <div class="card stat-card">

                <div class="stat-icon">
                    📚
                </div>

                <div>

                    <span>
                        محتوى الصف
                    </span>

                    <strong>
                        ${studentContents.length}
                    </strong>

                </div>

            </div>

        </div>


        <div class="card">

            <h3>
                مستواك الدراسي
            </h3>

            <br>

            <div>

                <div
                    style="
                    display:flex;
                    justify-content:space-between;
                    margin-bottom:8px;
                    "
                >

                    <span>
                        المستوى الحالي
                    </span>

                    <strong>
                        ${current}%
                    </strong>

                </div>


                <div class="progress">

                    <div
                        class="progress-bar"
                        style="
                        width:${Math.min(
                            100,
                            Math.max(
                                0,
                                current
                            )
                        )}%;
                        "
                    ></div>

                </div>

            </div>


            <br>


            <p>

                التغير عن المستوى السابق:

                <strong>
                    ${trend}
                </strong>

            </p>

        </div>

    `;

}


/* =========================================================
   PERFORMANCE LIST
   ========================================================= */

function renderPerformanceList() {

    const container =
        $("performanceList");


    if (!container) {

        return;

    }


    const students =
        studentsForCurrentGrade();


    if (
        !students.length
    ) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">
                    👨‍🎓
                </div>

                <h3>
                    لا يوجد طلاب في هذا الصف
                </h3>

                <p>
                    قم بإضافة أول طالب لعرض الأداء.
                </p>

            </div>

        `;

        return;

    }


    container.innerHTML =

        students
            .slice(0, 10)
            .map(
                student => {

                    const current =
                        Number(
                            student.current ||
                            0
                        );


                    const previous =
                        Number(
                            student.previous ||
                            0
                        );


                    const difference =
                        current -
                        previous;


                    const trend =

                        difference > 0

                            ? `↑ +${difference}%`

                            : difference < 0

                                ? `↓ ${difference}%`

                                : "→ ثابت";


                    return `

                        <div
                            class="progress-item"
                            style="margin-bottom:20px;"
                        >

                            <div
                                style="
                                display:flex;
                                justify-content:space-between;
                                gap:10px;
                                margin-bottom:8px;
                                "
                            >

                                <span>
                                    ${escapeHTML(
                                        student.name
                                    )}
                                </span>

                                <strong>
                                    ${current}%
                                    -
                                    ${trend}
                                </strong>

                            </div>


                            <div class="progress">

                                <div
                                    class="progress-bar"
                                    style="
                                    width:${Math.min(
                                        100,
                                        Math.max(
                                            0,
                                            current
                                        )
                                    )}%;
                                    "
                                ></div>

                            </div>

                        </div>

                    `;

                }
            )
            .join("");

}


/* =========================================================
   END OF FIRST PART
   ========================================================= */

/* =========================================================
   EduTrack - JavaScript
   PART 2 / 2
   ========================================================= */


/* =========================================================
   STUDENT MANAGEMENT
   ========================================================= */

function bindStudentActions() {

    $("addStudent")
        ?.addEventListener(
            "click",
            openStudentModal
        );


    $("studentForm")
        ?.addEventListener(
            "submit",
            createStudent
        );


    $("studentSearch")
        ?.addEventListener(
            "input",
            renderStudents
        );


    $("closeStudentModal")
        ?.addEventListener(
            "click",
            closeStudentModal
        );


    $("cancelStudent")
        ?.addEventListener(
            "click",
            closeStudentModal
        );

}


/* =========================================================
   OPEN STUDENT MODAL
   ========================================================= */

function openStudentModal() {

    if (
        !hasPermission(
            "management"
        )
    ) {

        alert(
            "ليس لديك صلاحية لإضافة الطلاب."
        );

        return;

    }


    const modal =
        $("studentModal");


    if (!modal) {

        createStudentModal();

        return;

    }


    modal.classList.remove(
        "hidden"
    );


    const grade =
        $("studentGrade");


    if (grade) {

        grade.value =
            currentGrade;

    }

}


/* =========================================================
   CREATE STUDENT MODAL
   ========================================================= */

function createStudentModal() {

    const modal =
        document.createElement(
            "div"
        );


    modal.id =
        "studentModal";


    modal.className =
        "modal";


    modal.innerHTML = `

        <div class="modal-box">

            <button
                id="closeStudentModal"
                class="close"
                type="button"
            >
                ×
            </button>


            <h2>
                إضافة طالب جديد
            </h2>


            <p
                style="
                color:#64748b;
                margin-bottom:20px;
                "
            >
                سيتم إنشاء ID والرقم السري تلقائيًا.
            </p>


            <form id="studentForm">

                <div class="form-group">

                    <label>
                        اسم الطالب
                    </label>

                    <input
                        id="studentName"
                        class="input"
                        type="text"
                        required
                        placeholder="اسم الطالب بالكامل"
                    >

                </div>


                <div class="form-group">

                    <label>
                        الصف
                    </label>

                    <select
                        id="studentGrade"
                        class="input"
                        required
                    >

                        ${gradeOptions(
                            currentGrade
                        )}

                    </select>

                </div>


                <div class="form-group">

                    <label>
                        المستوى الحالي %
                    </label>

                    <input
                        id="studentCurrent"
                        class="input"
                        type="number"
                        min="0"
                        max="100"
                        value="0"
                    >

                </div>


                <div class="form-group">

                    <label>
                        المستوى السابق %
                    </label>

                    <input
                        id="studentPrevious"
                        class="input"
                        type="number"
                        min="0"
                        max="100"
                        value="0"
                    >

                </div>


                <button
                    class="primary"
                    type="submit"
                >
                    إنشاء حساب الطالب
                </button>


                <div
                    id="accountResult"
                ></div>

            </form>

        </div>

    `;


    document.body.appendChild(
        modal
    );


    modal.classList.remove(
        "hidden"
    );


    $("closeStudentModal")
        ?.addEventListener(
            "click",
            closeStudentModal
        );


    $("studentForm")
        ?.addEventListener(
            "submit",
            createStudent
        );


    $("studentGrade").value =
        currentGrade;

}


/* =========================================================
   GRADE OPTIONS
   ========================================================= */

function gradeOptions(
    selected = ""
) {

    return Object
        .entries(GRADES)
        .map(
            ([key, name]) => `

                <option
                    value="${escapeAttribute(key)}"
                    ${key === selected
                        ? "selected"
                        : ""}
                >
                    ${escapeHTML(name)}
                </option>

            `
        )
        .join("");

}


/* =========================================================
   CLOSE STUDENT MODAL
   ========================================================= */

function closeStudentModal() {

    $("studentModal")
        ?.classList.add(
            "hidden"
        );

}


/* =========================================================
   GENERATE ID
   ========================================================= */

function generateStudentID() {

    let id;


    do {

        const random =
            Math.floor(
                100000 +
                Math.random() *
                900000
            );


        id =
            "STU" +
            random;

    } while (

        db.students.some(
            student =>
                student.id === id
        )

    );


    return id;

}


/* =========================================================
   GENERATE PASSWORD
   ========================================================= */

function generateStudentPassword() {

    const chars =
        "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";


    let password =
        "";


    for (
        let i = 0;
        i < 8;
        i++
    ) {

        password +=
            chars[
                Math.floor(
                    Math.random() *
                    chars.length
                )
            ];

    }


    return password;

}


/* =========================================================
   CREATE STUDENT
   ========================================================= */

function createStudent(
    event
) {

    event.preventDefault();


    if (
        !hasPermission(
            "management"
        )
    ) {

        alert(
            "ليس لديك صلاحية لإضافة الطلاب."
        );

        return;

    }


    const name =
        $("studentName")
            ?.value
            .trim();


    const grade =
        $("studentGrade")
            ?.value;


    const current =
        Number(
            $("studentCurrent")
                ?.value ||
            0
        );


    const previous =
        Number(
            $("studentPrevious")
                ?.value ||
            0
        );


    if (!name) {

        alert(
            "اكتب اسم الطالب."
        );

        return;

    }


    if (
        !GRADES[grade]
    ) {

        alert(
            "اختر الصف الدراسي."
        );

        return;

    }


    const id =
        generateStudentID();


    const password =
        generateStudentPassword();


    const student = {

        id,

        password,

        name,

        grade,

        current:
            Math.min(
                100,
                Math.max(
                    0,
                    current
                )
            ),

        previous:
            Math.min(
                100,
                Math.max(
                    0,
                    previous
                )
            ),

        createdAt:
            new Date()
                .toISOString()

    };


    db.students.push(
        student
    );


    saveData();


    const result =
        $("accountResult");
if (result) {

        result.innerHTML = `

            <div class="account-result">

                <strong>
                    تم إنشاء حساب الطالب بنجاح
                </strong>

                <br>

                اسم الطالب:
                <strong>
                    ${escapeHTML(name)}
                </strong>

                <br>

                الصف:
                <strong>
                    ${escapeHTML(
                        gradeName(grade)
                    )}
                </strong>

                <br>

                Student ID:
                <strong>
                    ${escapeHTML(id)}
                </strong>

                <br>

                الرقم السري:
                <strong>
                    ${escapeHTML(password)}
                </strong>

                <br><br>

                <button
                    type="button"
                    class="primary"
                    onclick="
                        copyAccount(
                            '${escapeAttribute(id)}',
                            '${escapeAttribute(password)}'
                        )
                    "
                >
                    نسخ بيانات الحساب
                </button>

            </div>

        `;

    }


    event.target.reset();


    $("studentGrade").value =
        currentGrade;


    renderStudents();

}


/* =========================================================
   COPY ACCOUNT
   ========================================================= */

function copyAccount(
    id,
    password
) {

    const text =

`EduTrack
Student ID: ${id}
Password: ${password}`;


    if (
        navigator.clipboard
    ) {

        navigator.clipboard
            .writeText(text)
            .then(
                () => {

                    alert(
                        "تم نسخ بيانات الحساب."
                    );

                }
            )
            .catch(
                () => {

                    fallbackCopy(
                        text
                    );

                }
            );

    } else {

        fallbackCopy(
            text
        );

    }

}


/* =========================================================
   FALLBACK COPY
   ========================================================= */

function fallbackCopy(
    text
) {

    const textarea =
        document.createElement(
            "textarea"
        );


    textarea.value =
        text;


    textarea.style.position =
        "fixed";

    textarea.style.opacity =
        "0";


    document.body.appendChild(
        textarea
    );


    textarea.select();


    try {

        document.execCommand(
            "copy"
        );


        alert(
            "تم نسخ بيانات الحساب."
        );

    } catch (error) {

        alert(
            text
        );

    }


    textarea.remove();

}


/* =========================================================
   RENDER STUDENTS
   ========================================================= */

function renderStudents() {

    const container =
        $("studentsTable");


    if (!container) {

        return;

    }


    const search =
        $("studentSearch")
            ?.value
            .trim()
            .toLowerCase() ||
        "";


    let students =
        studentsForCurrentGrade();


    if (search) {

        students =
            students.filter(
                student =>

                    String(
                        student.name
                    )
                        .toLowerCase()
                        .includes(search) ||

                    String(
                        student.id
                    )
                        .toLowerCase()
                        .includes(search)

            );

    }


    if (
        !students.length
    ) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">
                    👨‍🎓
                </div>

                <h3>
                    لا يوجد طلاب
                </h3>

                <p>
                    لا يوجد طلاب في الصف
                    ${escapeHTML(
                        gradeName(
                            currentGrade
                        )
                    )}
                </p>

            </div>

        `;

        return;

    }


    container.innerHTML = `

        <div class="table-wrap">

            <table>

                <thead>

                    <tr>

                        <th>
                            الطالب
                        </th>

                        <th>
                            ID
                        </th>

                        <th>
                            الصف
                        </th>

                        <th>
                            المستوى
                        </th>

                        <th>
                            التغير
                        </th>

                        ${
                            hasPermission(
                                "management"
                            )
                                ? `
                                    <th>
                                        إجراءات
                                    </th>
                                  `
                                : ""
                        }

                    </tr>

                </thead>


                <tbody>

                    ${students
                        .map(
                            student => {

                                const current =
                                    Number(
                                        student.current ||
                                        0
                                    );


                                const previous =
                                    Number(
                                        student.previous ||
                                        0
                                    );


                                const difference =
                                    current -
                                    previous;


                                const statusClass =

                                    difference > 0

                                        ? "status-success"

                                        : difference < 0

                                            ? "status-danger"

                                            : "status-info";


                                const trend =

                                    difference > 0

                                        ? `↑ +${difference}%`

                                        : difference < 0

                                            ? `↓ ${difference}%`

                                            : "→ ثابت";


                                return `

                                    <tr>

                                        <td>
                                            <strong>
                                                ${escapeHTML(
                                                    student.name
                                                )}
                                            </strong>
                                        </td>


                                        <td>
                                            ${escapeHTML(
                                                student.id
                                            )}
                                        </td>


                                        <td>
                                            ${escapeHTML(
                                                gradeName(
                                                    student.grade
                                                )
                                            )}
                                        </td>


                                        <td>

                                            <strong>
                                                ${current}%
                                            </strong>

                                        </td>


                                        <td>

                                            <span
                                                class="
                                                status
                                                ${statusClass}
                                                "
                                            >
                                                ${trend}
                                            </span>

                                        </td>


                                        ${
                                            hasPermission(
                                                "management"
                                            )
                                                ? `

                                                    <td>

                                                        <button
                                                            type="button"
                                                            class="danger"
                                                            onclick="
                                                                deleteStudent(
                                                                    '${escapeAttribute(
                                                                        student.id
                                                                    )}'
                                                                )
                                                            "
                                                        >
                                                            حذف
                                                        </button>

                                                    </td>

                                                  `
                                                : ""
                                        }

                                    </tr>

                                `;

                            }
                        )
                        .join("")}

                </tbody>

            </table>

        </div>

    `;

}


/* =========================================================
   DELETE STUDENT
   ========================================================= */

function deleteStudent(
    id
) {

    if (
        !hasPermission(
            "management"
        )
    ) {

        alert(
            "ليس لديك صلاحية حذف الطلاب."
        );

        return;

    }


    const student =
        db.students.find(
            item =>
                item.id === id
        );


    if (!student) {

        return;

    }


    const confirmed =
        confirm(

            `هل أنت متأكد من حذف الطالب "${student.name}"؟`

        );


    if (!confirmed) {

        return;

    }


    db.students =
        db.students.filter(
            item =>
                item.id !== id
        );


    saveData();


    renderStudents();

    renderDashboard();

}


/* =========================================================
   CONTENT MANAGEMENT
   ========================================================= */

function bindContentActions() {

    $("contentForm")
        ?.addEventListener(
            "submit",
            addContent
        );


    $("contentFile")
        ?.addEventListener(
            "change",
            previewSelectedFile
        );


    $("contentType")
        ?.addEventListener(
            "change",
            toggleContentInputs
        );


    $("contentGrade")
        ?.addEventListener(
            "change",
            renderContents
        );


    $("contentSearch")
        ?.addEventListener(
            "input",
            renderContents
        );


    toggleContentInputs();

}


/* =========================================================
   TOGGLE CONTENT INPUTS
   ========================================================= */

function toggleContentInputs() {

    const type =
        $("contentType")
            ?.value;


    const fileGroup =
        $("contentFileGroup");


    const urlGroup =
        $("contentUrlGroup");


    if (fileGroup) {

        fileGroup.style.display =

            [
                "image",
                "video",
                "file",
                "document"
            ]
                .includes(type)

                ? ""

                : "none";

    }


    if (urlGroup) {

        urlGroup.style.display =

            type ===
            "link"

                ? ""

                : "none";

    }

}


/* =========================================================
   PREVIEW SELECTED FILE
   ========================================================= */

function previewSelectedFile(
    event
) {

    const file =
        event.target.files?.[0];


    const preview =
        $("filePreview");


    if (!preview) {

        return;

    }


    if (!file) {

        preview.innerHTML =
            "";

        return;

    }


    const size =
        formatFileSize(
            file.size
        );


    let icon =
        "📄";


    if (
        file.type.startsWith(
            "image/"
        )
    ) {

        icon =
            "🖼️";

    }


    if (
        file.type.startsWith(
            "video/"
        )
    ) {

        icon =
            "🎬";

    }


    preview.innerHTML = `

        <div class="file-preview">

            <div class="file-preview-icon">
                ${icon}
            </div>

            <div class="file-name">
                ${escapeHTML(
                    file.name
                )}
            </div>

            <div class="file-size">
                ${size}
            </div>

        </div>

    `;

}


/* =========================================================
   FORMAT FILE SIZE
   ========================================================= */

function formatFileSize(
    bytes
) {

    if (
        bytes === 0
    ) {

        return "0 Bytes";

    }


    const units = [

        "Bytes",

        "KB",

        "MB",

        "GB"

    ];


    const index =
        Math.floor(
            Math.log(bytes) /
            Math.log(1024)
        );


    return (

        parseFloat(

            (
                bytes /
                Math.pow(
                    1024,
                    index
                )

            )
                .toFixed(2)

        ) +

        " " +

        units[index]

    );

}


/* =========================================================
   READ FILE AS DATA URL
   ========================================================= */

function readFileAsDataURL(
    file
) {

    return new Promise(
        (
            resolve,
            reject
        ) => {

            const reader =
                new FileReader();


            reader.onload =
                () => {

                    resolve(
                        reader.result
                    );

                };


            reader.onerror =
                () => {

                    reject(
                        reader.error
                    );

                };


            reader.readAsDataURL(
                file
            );

        }
    );

}


/* =========================================================
   ADD CONTENT
   ========================================================= */

async function addContent(
    event
) {

    event.preventDefault();


    if (
        !hasPermission(
            "upload"
        )
    ) {

        alert(
            "ليس لديك صلاحية إضافة المحتوى."
        );

        return;

    }


    const title =
        $("contentTitle")
            ?.value
            .trim();


    const description =
        $("contentDescription")
            ?.value
            .trim() ||
        "";


    const type =
        $("contentType")
            ?.value;


    const grade =
        $("contentGrade")
            ?.value ||
        currentGrade;


    const url =
        $("contentUrl")
            ?.value
            .trim() ||
        "";


    const file =
        $("contentFile")
            ?.files?.[0];


    if (!title) {

        alert(
            "اكتب عنوان المحتوى."
        );

        return;

    }


    if (
        !GRADES[grade]
    ) {

        alert(
            "اختر الصف."
        );

        return;

    }


    /*
     * رابط الإنترنت
     */

    if (
        type ===
        "link"
    ) {

        if (!isValidURL(url)) {

            alert(
                "أدخل رابط إنترنت صحيح."
            );

            return;

        }


        const content = {

            id:
                generateContentID(),

            title,

            description,

            type:
                detectLinkType(url),

            url,

            grade,

            source:
                "internet",

            createdAt:
                new Date()
                    .toISOString(),

            createdBy:
                "teacher"

        };


        db.contents.push(
            content
        );


        saveData();


        clearContentForm();

        renderContents();


        alert(
            "تم إضافة الرابط بنجاح."
        );


        return;

    }


    /*
     * ملف من الجهاز
     */

    if (!file) {

        alert(
            "اختر ملفًا من الجهاز."
        );

        return;

    }


    /*
     * حد أقصى للملفات
     * حتى لا تمتلئ localStorage بسرعة.
     */

    const MAX_FILE_SIZE =
        25 * 1024 * 1024;


    if (
        file.size >
        MAX_FILE_SIZE
    ) {

        alert(
            "حجم الملف أكبر من 25MB."
        );

        return;

    }


    try {

        const dataURL =
            await readFileAsDataURL(
                file
            );


        const detectedType =
            detectFileType(
                file
            );


        const content = {

            id:
                generateContentID(),

            title,

            description,

            type:
                detectedType,

            grade,

            source:
                "device",

            fileName:
                file.name,

            mimeType:
                file.type,

            size:
                file.size,

            dataURL,

            createdAt:
                new Date()
                    .toISOString(),

            createdBy:
                "teacher"

        };


        db.contents.push(
            content
        );


        saveData();


        clearContentForm();

        renderContents();


        alert(
            "تم رفع الملف وإضافته إلى المنصة بنجاح."
        );


    } catch (error) {

        console.error(
            error
        );


        alert(
            "حدث خطأ أثناء قراءة الملف."
        );

    }

}


/* =========================================================
   GENERATE CONTENT ID
   ========================================================= */

function generateContentID() {

    return (

        "CNT" +

        Date.now() +

        Math.floor(
            Math.random() *
            1000
        )

    );

}


/* =========================================================
   DETECT FILE TYPE
   ========================================================= */

function detectFileType(
    file
) {

    const mime =
        String(
            file.type ||
            ""
        )
            .toLowerCase();


    const name =
        String(
            file.name ||
            ""
        )
            .toLowerCase();


    if (
        mime.startsWith(
            "image/"
        )
    ) {

        return "image";

    }


    if (
        mime.startsWith(
            "video/"
        )
    ) {

        return "video";

    }


    if (

        mime.includes(
            "pdf"
        ) ||

        name.endsWith(
            ".pdf"
        )

    ) {

        return "pdf";

    }


    if (

        mime.includes(
            "word"
        ) ||

        name.endsWith(
            ".doc"
        ) ||

        name.endsWith(
            ".docx"
        )

    ) {

        return "word";

    }


    if (

        mime.includes(
            "presentation"
        ) ||

        name.endsWith(
            ".ppt"
        ) ||

        name.endsWith(
            ".pptx"
        )

    ) {

        return "powerpoint";

    }


    if (

        mime.includes(
            "spreadsheet"
        ) ||

        name.endsWith(
            ".xls"
        ) ||

        name.endsWith(
            ".xlsx"
        )

    ) {

        return "excel";

    }


    return "file";

}


/* =========================================================
   DETECT LINK TYPE
   ========================================================= */

function detectLinkType(
    url
) {

    const lower =
        url.toLowerCase();


    if (

        lower.includes(
            "youtube.com"
        ) ||

        lower.includes(
            "youtu.be"
        )

    ) {

        return "youtube";

    }


    if (

        lower.includes(
            "vimeo.com"
        )

    ) {

        return "vimeo";

    }


    return "link";

}


/* =========================================================
   VALID URL
   ========================================================= */

function isValidURL(
    value
) {

    try {

        const url =
            new URL(
                value
            );


        return (

            url.protocol ===
            "http:" ||

            url.protocol ===
            "https:"

        );

    } catch {

        return false;

    }

}


/* =========================================================
   CLEAR CONTENT FORM
   ========================================================= */

function clearContentForm() {

    $("contentForm")
        ?.reset();


    if (
        $("contentGrade")
    ) {

        $("contentGrade").value =
            currentGrade;

    }


    if (
        $("filePreview")
    ) {

        $("filePreview")
            .innerHTML =
            "";

    }


    toggleContentInputs();

}


/* =========================================================
   RENDER CONTENTS
   ========================================================= */

function renderContents() {

    const container =
        $("contentContainer");


    if (!container) {

        return;

    }


    /*
     * المشرف ممنوع من رؤية المحتوى
     */

    if (
        currentRole ===
        "supervisor"
    ) {

        container.innerHTML = `

            <div class="readonly-banner">

                🔒
                <strong>
                    المحتوى التعليمي غير متاح للمشرف.
                </strong>

                <br>

                يمكنك الاطلاع على التقارير
                والمتابعة فقط.

            </div>

        `;

        return;

    }


    let contents =
        contentsForCurrentGrade();


    const search =
        $("contentSearch")
            ?.value
            .trim()
            .toLowerCase() ||
        "";


    if (search) {

        contents =
            contents.filter(
                content =>

                    String(
                        content.title ||
                        ""
                    )
                        .toLowerCase()
                        .includes(search)

            );

    }


    if (
        !contents.length
    ) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">
                    📚
                </div>

                <h3>
                    لا يوجد محتوى
                </h3>

                <p>
                    لا يوجد محتوى تعليمي
                    لهذا الصف حتى الآن.
                </p>

            </div>

        `;

        return;

    }


    container.innerHTML = `

        <div class="content-grid">

            ${contents
                .map(
                    content =>
                        contentCard(
                            content
                        )
                )
                .join("")}

        </div>

    `;

}


/* =========================================================
   CONTENT CARD
   ========================================================= */

function contentCard(
    content
) {

    const title =
        escapeHTML(
            content.title
        );


    const description =
        escapeHTML(
            content.description ||
            ""
        );


    let preview =
        "";


    /*
     * صورة
     */

    if (
        content.type ===
        "image"
    ) {

        preview = `

            <div class="image-preview">

                <img
                    src="${escapeAttribute(
                        content.dataURL
                    )}"
                    alt="${escapeAttribute(
                        content.title
                    )}"
                >

            </div>

        `;

    }


    /*
     * فيديو من الجهاز
     */

    else if (
        content.type ===
        "video"
    ) {

        preview = `

            <div class="video-preview">

                <video
                    controls
                    preload="metadata"
                >

                    <source
                        src="${escapeAttribute(
                            content.dataURL
                        )}"
                        type="${escapeAttribute(
                            content.mimeType ||
                            "video/mp4"
                        )}"
                    >

                    المتصفح لا يدعم تشغيل الفيديو.

                </video>

            </div>

        `;

    }


    /*
     * YouTube / Vimeo
     */

    else if (

        content.type ===
        "youtube" ||

        content.type ===
        "vimeo"

    ) {

        const embed =
            getVideoEmbedURL(
                content.url
            );


        if (embed) {

            preview = `

                <iframe
                    src="${escapeAttribute(
                        embed
                    )}"
                    allowfullscreen
                    loading="lazy"
                    title="${escapeAttribute(
                        content.title
                    )}"
                ></iframe>

            `;

        } else {

            preview = `

                <div class="content-type">
                    🎬
                </div>

            `;

        }

    }


    /*
     * PDF
     */

    else if (
        content.type ===
        "pdf"
    ) {

        preview = `

            <div class="content-type">
                📕
            </div>

        `;

    }


    /*
     * Word
     */

    else if (
        content.type ===
        "word"
    ) {

        preview = `

            <div class="content-type">
                📝
            </div>

        `;

    }


    /*
     * PowerPoint
     */

    else if (
        content.type ===
        "powerpoint"
    ) {

        preview = `

            <div class="content-type">
                📊
            </div>

        `;

    }


    /*
     * Excel
     */

    else if (
        content.type ===
        "excel"
    ) {

        preview = `

            <div class="content-type">
                📗
            </div>

        `;

    }


    /*
     * رابط
     */

    else {

        preview = `

            <div class="content-type">
                🔗
            </div>

        `;

    }


    return `

        <article class="content-card">

            ${preview}


            <div class="content-card-body">

                <h3>
                    ${title}
                </h3>


                ${
                    description
                        ? `
                            <p>
                                ${description}
                            </p>
                          `
                        : ""
                }


                <p
                    style="
                    margin-top:8px;
                    "
                >

                    <strong>
                        الصف:
                    </strong>

                    ${escapeHTML(
                        gradeName(
                            content.grade
                        )
                    )}

                </p>


                <div class="content-actions">

                    ${contentDownloadButton(
                        content
                    )}


                    ${
                        content.source ===
                        "internet"
                            ? `

                                <a
                                    href="${escapeAttribute(
                                        content.url
                                    )}"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    class="primary"
                                    style="
                                    display:inline-flex;
                                    align-items:center;
                                    text-decoration:none;
                                    "
                                >
                                    فتح الرابط
                                </a>

                              `
                            : ""
                    }


                    ${
                        hasPermission(
                            "delete"
                        )
                            ? `

                                <button
                                    type="button"
                                    class="danger"
                                    onclick="
                                        deleteContent(
                                            '${escapeAttribute(
                                                content.id
                                            )}'
                                        )
                                    "
                                >
                                    حذف
                                </button>

                              `
                            : ""
                    }

                </div>

            </div>

        </article>

    `;

}


/* =========================================================
   CONTENT DOWNLOAD BUTTON
   ========================================================= */

function contentDownloadButton(
    content
) {

    if (
        content.source ===
        "internet"
    ) {

        return "";

    }


    if (
        !content.dataURL
    ) {

        return "";

    }


    return `

        <a
            href="${escapeAttribute(
                content.dataURL
            )}"
            download="${escapeAttribute(
                content.fileName ||
                content.title
            )}"
            class="secondary"
            style="
            display:inline-flex;
            align-items:center;
            text-decoration:none;
            "
        >
            ⬇️ فتح / تحميل
        </a>

    `;

}


/* =========================================================
   GET VIDEO EMBED URL
   ========================================================= */

function getVideoEmbedURL(
    url
) {

    try {

        const parsed =
            new URL(
                url
            );


        /*
         * YouTube
         */

        if (
            parsed.hostname.includes(
                "youtube.com"
            )
        ) {

            const id =
                parsed.searchParams.get(
                    "v"
                );


            if (id) {

                return (
                    "https://www.youtube.com/embed/" +
                    encodeURIComponent(
                        id
                    )
                );

            }

        }


        /*
         * youtu.be
         */

        if (
            parsed.hostname ===
            "youtu.be"
        ) {

            const id =
                parsed.pathname
                    .replace(
                        "/",
                        ""
                    );


            if (id) {

                return (
                    "https://www.youtube.com/embed/" +
                    encodeURIComponent(
                        id
                    )
                );

            }

        }


        /*
         * YouTube Shorts
         */

        if (
            parsed.pathname.startsWith(
                "/shorts/"
            )
        ) {

            const id =
                parsed.pathname
                    .split(
                        "/"
                    )[2];


            if (id) {

                return (
                    "https://www.youtube.com/embed/" +
                    encodeURIComponent(
                        id
                    )
                );

            }

        }


        /*
         * Vimeo
         */

        if (
            parsed.hostname.includes(
                "vimeo.com"
            )
        ) {

            const parts =
                parsed.pathname
                    .split("/")
                    .filter(Boolean);


            const id =
                parts[
                    parts.length - 1
                ];


            if (id) {

                return (
                    "https://player.vimeo.com/video/" +
                    encodeURIComponent(
                        id
                    )
                );

            }

        }

    } catch (error) {

        return null;

    }


    return null;

}


/* =========================================================
   DELETE CONTENT
   ========================================================= */

function deleteContent(
    id
) {

    if (
        !hasPermission(
            "delete"
        )
    ) {

        alert(
            "ليس لديك صلاحية حذف المحتوى."
        );

        return;

    }


    const content =
        db.contents.find(
            item =>
                item.id === id
        );


    if (!content) {

        return;

    }


    const confirmed =
        confirm(

            `هل تريد حذف "${content.title}"؟`

        );


    if (!confirmed) {

        return;

    }


    db.contents =
        db.contents.filter(
            item =>
                item.id !== id
        );


    /* حذف ملف المحتوى من IndexedDB */

    deleteFileFromIDB(id)
        .catch(err => {

            console.error(
                "IDB delete error:",
                err
            );

        });


    saveData();


    renderContents();

}


/* =========================================================
   REPORTS
   ========================================================= */

function renderReports() {

    const container =
        $("reportsContainer");


    if (!container) {

        return;

    }


    if (
        currentRole ===
        "student"
    ) {

        container.innerHTML = `

            <div class="empty-state">

                <div class="empty-state-icon">
                    🔒
                </div>

                <h3>
                    التقارير غير متاحة
                </h3>

                <p>
                    هذه الصفحة مخصصة للمعلم والمشرف.
                </p>

            </div>

        `;

        return;

    }


    const students =
        studentsForCurrentGrade();


    const total =
        students.length;


    const average =
        total

            ? Math.round(

                students.reduce(

                    (
                        sum,
                        student
                    ) =>

                        sum +
                        Number(
                            student.current ||
                            0
                        ),

                    0

                ) /
                total

            )

            : 0;


    const improving =
        students.filter(
            student =>

                Number(
                    student.current ||
                    0
                ) >

                Number(
                    student.previous ||
                    0
                )

        ).length;


    const needsFollowUp =
        students.filter(
            student =>

                Number(
                    student.current ||
                    0
                ) < 50

        ).length;


    container.innerHTML = `

        <div class="report-grid">

            <div class="report-card">

                <div class="report-card-title">
                    عدد الطلاب
                </div>

                <div class="report-card-value">
                    ${total}
                </div>

            </div>


            <div class="report-card">

                <div class="report-card-title">
                    متوسط الصف
                </div>

                <div class="report-card-value">
                    ${average}%
                </div>

            </div>


            <div class="report-card">

                <div class="report-card-title">
                    الطلاب المتحسنون
                </div>

                <div class="report-card-value">
                    ${improving}
                </div>

            </div>


            <div class="report-card">

                <div class="report-card-title">
                    يحتاجون متابعة
                </div>

                <div class="report-card-value">
                    ${needsFollowUp}
                </div>

            </div>

        </div>


        <div class="card">

            <div class="page-header">

                <div>

                    <h2>
                        تقرير
                        ${escapeHTML(
                            gradeName(
                                currentGrade
                            )
                        )}
                    </h2>

                    <p>
                        ${
                            currentRole ===
                            "supervisor"

                                ? "عرض تقارير ومتابعة فقط"

                                : "تقرير متابعة الطلاب"
                        }
                    </p>

                </div>

            </div>


            ${
                students.length

                    ? `

                        <div class="table-wrap">

                            <table>

                                <thead>

                                    <tr>

                                        <th>
                                            الطالب
                                        </th>

                                        <th>
                                            المستوى السابق
                                        </th>

                                        <th>
                                            المستوى الحالي
                                        </th>

                                        <th>
                                            التغير
                                        </th>

                                        <th>
                                            الحالة
                                        </th>

                                    </tr>

                                </thead>


                                <tbody>

                                    ${students
                                        .map(
                                            student => {

                                                const previous =
                                                    Number(
                                                        student.previous ||
                                                        0
                                                    );


                                                const current =
                                                    Number(
                                                        student.current ||
                                                        0
                                                    );


                                                const difference =
                                                    current -
                                                    previous;


                                                let status =
                                                    "مستقر";


                                                let statusClass =
                                                    "status-info";


                                                if (
                                                    difference > 0
                                                ) {

                                                    status =
                                                        "متحسن";

                                                    statusClass =
                                                        "status-success";

                                                }


                                                if (
                                                    difference < 0
                                                ) {

                                                    status =
                                                        "يحتاج متابعة";

                                                    statusClass =
                                                        "status-danger";

                                                }


                                                return `

                                                    <tr>

                                                        <td>

                                                            <strong>
                                                                ${escapeHTML(
                                                                    student.name
                                                                )}
                                                            </strong>

                                                        </td>


                                                        <td>
                                                            ${previous}%
                                                        </td>


                                                        <td>
                                                            ${current}%
                                                        </td>


                                                        <td>
                                                            ${
                                                                difference > 0
                                                                    ? "+"
                                                                    : ""
                                                            }${difference}%
                                                        </td>


                                                        <td>

                                                            <span
                                                                class="
                                                                status
                                                                ${statusClass}
                                                                "
                                                            >
                                                                ${status}
                                                            </span>

                                                        </td>

                                                    </tr>

                                                `;

                                            }
                                        )
                                        .join("")}

                                </tbody>

                            </table>

                        </div>

                      `

                    : `

                        <div class="empty-state">

                            <div class="empty-state-icon">
                                📊
                            </div>

                            <h3>
                                لا توجد بيانات
                            </h3>

                            <p>
                                لا يوجد طلاب مسجلون في هذا الصف.
                            </p>

                        </div>

                      `

            }

        </div>

    `;

}


/* =========================================================
   GLOBAL BUTTONS
   ========================================================= */

function bindGlobalButtons() {

    document
        .querySelectorAll(
            "[data-logout]"
        )
        .forEach(
            button => {

                button.addEventListener(
                    "click",
                    logout
                );

            }
        );


    $("logoutButton")
        ?.addEventListener(
            "click",
            logout
        );


    $("switchRole")
        ?.addEventListener(
            "click",
            logout
        );

}


/* =========================================================
   LOGOUT
   ========================================================= */

function logout() {

    const confirmed =
        confirm(
            "هل تريد تسجيل الخروج؟"
        );


    if (!confirmed) {

        return;

    }


    currentRole =
        null;


    currentUser =
        null;


    currentGrade =
        null;


    showRoleScreen();

}


/* =========================================================
   RESET DATABASE
   ========================================================= */

function resetEduTrackData() {

    if (
        currentRole !==
        "teacher"
    ) {

        alert(
            "هذه العملية متاحة للمدرس فقط."
        );

        return;

    }


    const confirmed =
        confirm(

            "تحذير: سيتم حذف جميع الطلاب والمحتوى المحفوظ على هذا المتصفح. هل تريد المتابعة؟"

        );


    if (!confirmed) {

        return;

    }


    db = {

        students: [],

        contents: []

    };


    /* حذف جميع الملفات من IndexedDB */

    clearAllFilesFromIDB()
        .catch(err => {

            console.error(
                "IDB clear error:",
                err
            );

        });


    saveData();


    renderDashboard();

    renderStudents();

    renderContents();

    renderReports();


    alert(
        "تم حذف البيانات المحلية."
    );

}


/* =========================================================
   EXPORT DATA
   ========================================================= */

function exportEduTrackData() {

    if (
        currentRole !==
        "teacher"
    ) {

        alert(
            "تصدير البيانات متاح للمدرس فقط."
        );

        return;

    }


    const data =
        JSON.stringify(
            db,
            null,
            2
        );


    const blob =
        new Blob(
            [data],
            {
                type:
                    "application/json"
            }
        );


    const url =
        URL.createObjectURL(
            blob
        );


    const link =
        document.createElement(
            "a"
        );


    link.href =
        url;


    link.download =
        "EduTrack-backup.json";


    document.body.appendChild(
        link
    );


    link.click();


    link.remove();


    URL.revokeObjectURL(
        url
    );

}


/* =========================================================
   IMPORT DATA
   ========================================================= */

function importEduTrackData(
    file
) {

    if (
        currentRole !==
        "teacher"
    ) {

        alert(
            "استيراد البيانات متاح للمدرس فقط."
        );

        return;

    }


    if (!file) {

        return;

    }


    const reader =
        new FileReader();


    reader.onload =
        event => {

            try {

                const imported =
                    JSON.parse(
                        event.target.result
                    );


                if (
                    !Array.isArray(
                        imported.students
                    ) ||

                    !Array.isArray(
                        imported.contents
                    )

                ) {

                    throw new Error(
                        "Invalid data"
                    );

                }


                db =
                    imported;


                saveData();


                renderDashboard();

                renderStudents();

                renderContents();

                renderReports();


                alert(
                    "تم استيراد البيانات بنجاح."
                );


            } catch (error) {

                console.error(
                    error
                );


                alert(
                    "ملف البيانات غير صالح."
                );

            }

        };


    reader.readAsText(
        file
    );

}


/* =========================================================
   AUTOMATIC BACKUP HELPERS
   ========================================================= */

function getDatabaseSize() {

    try {

        const data =
            localStorage.getItem(
                STORAGE_KEY
            ) ||
            "";


        return formatFileSize(
            new Blob(
                [data]
            ).size
        );

    } catch {

        return "غير معروف";

    }

}


/* =========================================================
   INITIAL DEFAULT DATA
   ========================================================= */

function createDemoDataIfNeeded() {

    if (
        db.students.length ||
        db.contents.length
    ) {

        return;

    }


    /*
     * لا يتم إنشاء بيانات تجريبية تلقائيًا
     * حتى لا تظهر بيانات وهمية للمستخدم.
     */

}


/* =========================================================
   SECURITY HELPERS
   ========================================================= */

function sanitizeURL(
    value
) {

    if (
        !isValidURL(
            value
        )
    ) {

        return "";

    }


    try {

        const url =
            new URL(
                value
            );


        if (
            url.protocol !==
                "http:" &&

            url.protocol !==
                "https:"
        ) {

            return "";

        }


        return url.href;

    } catch {

        return "";

    }

}


/* =========================================================
   PREVENT ACCIDENTAL FORM SUBMISSION
   ========================================================= */

document.addEventListener(
    "submit",
    event => {

        const form =
            event.target;


        if (
            !form.matches(
                "#studentForm, #contentForm"
            )
        ) {

            /*
             * لا نمنع النماذج الخاصة
             * إذا كانت موجودة في HTML.
             */

            return;

        }

    }
);


/* =========================================================
   KEYBOARD SHORTCUT
   ========================================================= */

document.addEventListener(
    "keydown",
    event => {

        /*
         * Escape لإغلاق الـ Modal
         */

        if (
            event.key ===
            "Escape"
        ) {

            $("studentModal")
                ?.classList.add(
                    "hidden"
                );

        }

    }
);


/* =========================================================
   EXPORT FUNCTIONS FOR HTML
   ========================================================= */

window.EduTrack = {

    logout,

    openPage,

    renderDashboard,

    renderStudents,

    renderContents,

    renderReports,

    createStudent,

    addContent,

    deleteStudent,

    deleteContent,

    exportEduTrackData,

    importEduTrackData,

    resetEduTrackData,

    getDatabaseSize,

    gradeName

};


/* =========================================================
   FINAL INITIALIZATION
   ========================================================= */
/* تم حذف saveData() من هنا
 * لأنها كانت تُنفذ قبل loadData()
 * فتمسح البيانات المحفوظة كل مرة يتم فيها فتح الصفحة
 */

createDemoDataIfNeeded();



console.log(
    "EduTrack initialized successfully."
);

console.log(
    "Current grade:",
    currentGrade
);

console.log(
    "Teacher password protection enabled."
);


/* =========================================================
   END OF JAVASCRIPT
   ========================================================= */