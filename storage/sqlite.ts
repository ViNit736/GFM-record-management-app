import * as SQLite from 'expo-sqlite';

export const dbPromise = SQLite.openDatabaseAsync('gfm_record.db');

// ============= INTERFACES =============

export interface Student {
  prn: string;
  fullName: string;
  gender: string;
  religion: string;
  category: string;
  caste: string;
  dob: string;
  branch: string;
  division: string;
  yearOfStudy: string;
  phone: string;
  email: string;
  aadhar: string;
  permanentAddress: string;
  pincode: string;
  temporaryAddress: string;
  fatherName: string;
  motherName: string;
  fatherOccupation: string;
  motherOccupation: string;
  annualIncome: string;
  fatherPhone: string;
  motherPhone: string;
  sscSchool: string;
  sscMarks: string;
  sscMaxMarks: string;
  sscPercentage: string;
  sscYear: string;
  hscCollege: string;
  hscMarks: string;
  hscMaxMarks: string;
  hscPercentage: string;
  hscYear: string;
  diplomaCollege: string;
  diplomaMarks: string;
  diplomaMaxMarks: string;
  diplomaPercentage: string;
  diplomaYear: string;
  diplomaBranch: string;
  diplomaBoard: string;
  diplomaState: string;
  diplomaCity: string;
  diplomaCgpa: string;
  diplomaPassingMonth: string;
  admissionType: string;
  jeePercentile: string;
  mhtCetPercentile: string;
  photoUri: string;
  lastUpdated?: string;
  verificationStatus?: string;
  verifiedBy?: string;
}

export interface Achievement {
  id?: number;
  prn: string;
  semester: number;
  achievementName: string;
  type: string;
  achievementDate: string;
  certificateUri?: string;
  verificationStatus?: string;
  verifiedBy?: string;
  createdAt?: string;
}

export interface Course {
  id?: number;
  prn: string;
  courseName: string;
  platform: string;
  duration: string;
  completionDate: string;
  certificateUri?: string;
  verificationStatus?: string;
  verifiedBy?: string;
  createdAt?: string;
}

export interface StudentActivity {
  id?: number;
  prn: string;
  semester: number;
  activityName: string;
  type: 'Extra-curricular' | 'Co-curricular' | 'Courses';
  activityDate: string;
  certificateUri?: string;
  verificationStatus?: string;
  verifiedBy?: string;
  createdAt?: string;
}

export interface FeePayment {
  id?: number;
  prn: string;
  academicYear: string;
  category: string;
  totalFee: number;
  installmentNumber: number;
  paymentDate: string;
  amountPaid: number;
  remainingBalance: number;
  paymentMode: string;
  receiptUri: string;
  verificationStatus?: string;
  verifiedBy?: string;
  createdAt?: string;
}

export interface TechnicalActivity {
  id?: number;
  prn: string;
  semester: number;
  academicYear: string;
  activityName: string;
  activityDate: string;
  description: string;
  certificateUri?: string;
  verificationStatus?: string;
  verifiedBy?: string;
  createdAt?: string;
}

export interface NonTechnicalActivity {
  id?: number;
  prn: string;
  semester: number;
  academicYear: string;
  activityName: string;
  activityDate: string;
  description: string;
  certificateUri?: string;
  verificationStatus?: string;
  verifiedBy?: string;
  createdAt?: string;
}

export interface Internship {
  id?: number;
  prn: string;
  semester: number;
  companyName: string;
  role: string;
  internshipType: 'Paid' | 'Unpaid';
  startDate: string;
  endDate: string;
  duration: number;
  stipend?: number;
  description?: string;
  certificateUri?: string;
  verificationStatus?: string;
  verifiedBy?: string;
  createdAt?: string;
}

export interface CourseDef {
  id?: number;
  courseCode: string;
  courseName: string;
  department: string;
  semester: number;
  credits: number;
  iseMax: number;
  mseMax: number;
  eseMax: number;
}

export interface CourseAssignment {
  id?: number;
  courseDefId: number;
  teacherPrn: string;
  division: string;
  isPrimary: number; // 1 for true, 0 for false
}

export interface AcademicRecord {
  id?: number;
  prn: string;
  courseDefId: number;
  semester: number;
  iseMarks: number;
  mseMarks: number;
  eseMarks: number;
  totalMarks: number;
  grade: string;
  sgpa: number;
  cgpa: number;
  academicYear: string;
}

// ============= DATABASE INITIALIZATION =============

export const initDB = async () => {
  const db = await dbPromise;
  
  try {
    await db.execAsync('PRAGMA foreign_keys = ON;');

    // Users table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS users (
        prn TEXT PRIMARY KEY NOT NULL,
        password TEXT NOT NULL,
        role TEXT NOT NULL,
        isProfileComplete INTEGER DEFAULT 0
      );
    `);

    // --- SEED TEST USERS ---
    // Ensure test users exist with correct credentials
    await db.runAsync(
      'INSERT OR REPLACE INTO users (prn, password, role, isProfileComplete) VALUES (?, ?, ?, ?)',
      ['2024STUDENT1', 'password123', 'student', 0]
    );
    await db.runAsync(
      'INSERT OR REPLACE INTO users (prn, password, role, isProfileComplete) VALUES (?, ?, ?, ?)',
      ['2024TEACHER1', 'password123', 'teacher', 1]
    );
    console.log("✅ Ensured test users exist (Overwritten): 2024STUDENT1, 2024TEACHER1");

    // Students table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS students (
        prn TEXT PRIMARY KEY NOT NULL,
        fullName TEXT, gender TEXT, religion TEXT, category TEXT, caste TEXT,
        dob TEXT, branch TEXT, division TEXT, yearOfStudy TEXT, phone TEXT, email TEXT, aadhar TEXT,
        permanentAddress TEXT, pincode TEXT, temporaryAddress TEXT,
        fatherName TEXT, motherName TEXT, fatherOccupation TEXT, motherOccupation TEXT,
        annualIncome TEXT, fatherPhone TEXT, motherPhone TEXT,
        sscSchool TEXT, sscMarks TEXT, sscMaxMarks TEXT, sscPercentage TEXT, sscYear TEXT,
        hscCollege TEXT, hscMarks TEXT, hscMaxMarks TEXT, hscPercentage TEXT, hscYear TEXT,
        diplomaCollege TEXT, diplomaMarks TEXT, diplomaMaxMarks TEXT, diplomaPercentage TEXT, 
        diplomaYear TEXT, diplomaBranch TEXT, diplomaBoard TEXT, diplomaState TEXT, diplomaCity TEXT,
        diplomaCgpa TEXT, diplomaPassingMonth TEXT, admissionType TEXT, jeePercentile TEXT, 
        mhtCetPercentile TEXT, photoUri TEXT, lastUpdated TEXT,
        verificationStatus TEXT DEFAULT 'Pending',
        verifiedBy TEXT,
        FOREIGN KEY (prn) REFERENCES users (prn) ON DELETE CASCADE
      );
    `);

    // Ensure missing columns exist in students table (Migrations)
    const tableInfo = await db.getAllAsync<any>("PRAGMA table_info(students)");
    const columns = tableInfo.map(c => c.name);
    
    const requiredColumns = [
      { name: 'yearOfStudy', type: 'TEXT' },
      { name: 'branch', type: 'TEXT' },
      { name: 'division', type: 'TEXT' },
      { name: 'verificationStatus', type: "TEXT DEFAULT 'Pending'" },
      { name: 'verifiedBy', type: 'TEXT' }
    ];

    for (const col of requiredColumns) {
      if (!columns.includes(col.name)) {
        try {
          await db.execAsync(`ALTER TABLE students ADD COLUMN ${col.name} ${col.type};`);
          console.log(`✅ Added ${col.name} column to students table`);
        } catch (e) {
          console.error(`❌ Failed to add ${col.name} column:`, e);
        }
      }
    }

    // --- SEED TEST STUDENT DETAILS ---
    try {
      const countRows = await db.getAllAsync<any>("SELECT COUNT(1) as cnt FROM students");
      const cnt = Array.isArray(countRows) && countRows.length > 0 ? countRows[0].cnt : 0;
        if (!cnt) {
        await db.runAsync(
          `INSERT OR REPLACE INTO students (
            prn, fullName, gender, dob, branch, division, yearOfStudy, phone, email, permanentAddress, verificationStatus
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            '2024STUDENT1',
            'Student One',
            'Male',
            '2005-01-01',
            'Computer Engineering',
            'A',
            'FE',
            '9876543210',
            'student1@example.com',
            '123, College Road, City',
            'Verified'
          ]
        );
        console.log('✅ Seeded student details for 2024STUDENT1');

        // Seed Course Definitions
        await db.runAsync(
          `INSERT OR REPLACE INTO courses_def (courseCode, courseName, department, semester, credits) VALUES 
          ('CS301', 'Data Structures', 'Computer Engineering', 3, 4),
          ('CS302', 'Operating Systems', 'Computer Engineering', 3, 4),
          ('CS401', 'Algorithms', 'Computer Engineering', 4, 4),
          ('CS402', 'Database Systems', 'Computer Engineering', 4, 4)`
        );

        // Seed Academic Records
        const courses = await db.getAllAsync<any>("SELECT id FROM courses_def");
        if (courses.length >= 4) {
          await db.runAsync(
            `INSERT OR REPLACE INTO academic_records (prn, courseDefId, semester, iseMarks, mseMarks, eseMarks, totalMarks, grade, academicYear) VALUES 
            ('2024STUDENT1', ?, 3, 18, 25, 42, 83, 'A', '2024-25'),
            ('2024STUDENT1', ?, 3, 15, 20, 35, 70, 'B', '2024-25'),
            ('2024STUDENT1', ?, 4, 19, 28, 45, 92, 'O', '2024-25'),
            ('2024STUDENT1', ?, 4, 17, 22, 38, 77, 'A', '2024-25')`,
            [courses[0].id, courses[1].id, courses[2].id, courses[3].id]
          );
        }
        console.log('✅ Seeded academic records for 2024STUDENT1');

        // Seed some mock documents for testing
          await db.runAsync(
            `INSERT OR REPLACE INTO achievements (prn, semester, achievementName, type, achievementDate, certificateUri, verificationStatus) VALUES 
            ('2024STUDENT1', 3, 'Hackathon Winner', 'Technical', '2024-10-15', 'https://example.com/cert1.pdf', 'Verified')`
          );
        await db.runAsync(
          `INSERT OR REPLACE INTO fee_payments (prn, academicYear, category, totalFee, installmentNumber, paymentDate, amountPaid, remainingBalance, paymentMode, receiptUri, verificationStatus) VALUES 
          ('2024STUDENT1', '2024-25', 'Open', 50000, 1, '2024-07-20', 25000, 25000, 'UPI', 'https://example.com/receipt1.jpg', 'Verified')`
        );
      }
    } catch (e) {
      console.warn('⚠️ Could not seed student details:', e);
    }

    // Achievements table (Improved)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS achievements (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prn TEXT NOT NULL,
        semester INTEGER NOT NULL,
        achievementName TEXT NOT NULL,
        type TEXT NOT NULL,
        achievementDate TEXT NOT NULL,
        certificateUri TEXT,
        verificationStatus TEXT DEFAULT 'Pending',
        verifiedBy TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (prn) REFERENCES users (prn) ON DELETE CASCADE
      );
    `);

    // Ensure achievementDate column exists in achievements table (Migration)
    const achInfo = await db.getAllAsync<any>("PRAGMA table_info(achievements)");
    const achColumns = achInfo.map(c => c.name);
    if (!achColumns.includes('achievementDate')) {
      try {
        await db.execAsync("ALTER TABLE achievements ADD COLUMN achievementDate TEXT NOT NULL DEFAULT '';");
        console.log("✅ Added achievementDate column to achievements table");
      } catch (e) {
        console.error("❌ Failed to add achievementDate column:", e);
      }
    }

    // Student Activities table (Unified)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS student_activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prn TEXT NOT NULL,
        semester INTEGER NOT NULL,
        activityName TEXT NOT NULL,
        type TEXT NOT NULL, -- 'Extra-curricular' | 'Co-curricular' | 'Courses'
        activityDate TEXT NOT NULL,
        certificateUri TEXT,
        verificationStatus TEXT DEFAULT 'Pending',
        verifiedBy TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (prn) REFERENCES users (prn) ON DELETE CASCADE
      );
    `);

    // Ensure activityDate column exists in student_activities table (Migration)
    const actInfo = await db.getAllAsync<any>("PRAGMA table_info(student_activities)");
    const actColumns = actInfo.map(c => c.name);
    if (!actColumns.includes('activityDate')) {
      try {
        await db.execAsync("ALTER TABLE student_activities ADD COLUMN activityDate TEXT NOT NULL DEFAULT '';");
        console.log("✅ Added activityDate column to student_activities table");
      } catch (e) {
        console.error("❌ Failed to add activityDate column:", e);
      }
    }

    // Courses table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS courses (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prn TEXT NOT NULL,
        courseName TEXT NOT NULL,
        platform TEXT NOT NULL,
        duration TEXT NOT NULL,
        completionDate TEXT NOT NULL,
        certificateUri TEXT,
        verificationStatus TEXT DEFAULT 'Pending',
        verifiedBy TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (prn) REFERENCES users (prn) ON DELETE CASCADE
      );
    `);

    // Fee Payments table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS fee_payments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prn TEXT NOT NULL,
        academicYear TEXT NOT NULL,
        category TEXT NOT NULL,
        totalFee REAL NOT NULL,
        installmentNumber INTEGER NOT NULL,
        paymentDate TEXT NOT NULL,
        amountPaid REAL NOT NULL,
        remainingBalance REAL NOT NULL,
        paymentMode TEXT NOT NULL,
        receiptUri TEXT,
        verificationStatus TEXT DEFAULT 'Pending',
        verifiedBy TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (prn) REFERENCES users (prn) ON DELETE CASCADE
      );
    `);

    // Technical Activities table (Co-curricular)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS technical_activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prn TEXT NOT NULL,
        semester INTEGER NOT NULL,
        academicYear TEXT NOT NULL,
        activityName TEXT NOT NULL,
        activityDate TEXT NOT NULL,
        description TEXT,
        certificateUri TEXT,
        verificationStatus TEXT DEFAULT 'Pending',
        verifiedBy TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (prn) REFERENCES users (prn) ON DELETE CASCADE
      );
    `);

    // Non-Technical Activities table (Extra-curricular)
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS non_technical_activities (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prn TEXT NOT NULL,
        semester INTEGER NOT NULL,
        academicYear TEXT NOT NULL,
        activityName TEXT NOT NULL,
        activityDate TEXT NOT NULL,
        description TEXT,
        certificateUri TEXT,
        verificationStatus TEXT DEFAULT 'Pending',
        verifiedBy TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (prn) REFERENCES users (prn) ON DELETE CASCADE
      );
    `);

    // Internships table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS internships (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prn TEXT NOT NULL,
        semester INTEGER NOT NULL DEFAULT 3,
        companyName TEXT NOT NULL,
        role TEXT NOT NULL,
        internshipType TEXT NOT NULL,
        startDate TEXT NOT NULL,
        endDate TEXT NOT NULL,
        duration INTEGER NOT NULL,
        stipend REAL,
        description TEXT,
        certificateUri TEXT,
        verificationStatus TEXT DEFAULT 'Pending',
        verifiedBy TEXT,
        createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (prn) REFERENCES users (prn) ON DELETE CASCADE
      );
    `);

    // Ensure semester column exists in internships (Migration)
    const internshipInfo = await db.getAllAsync<any>("PRAGMA table_info(internships)");
    const internshipColumns = internshipInfo.map(c => c.name);
    if (!internshipColumns.includes('semester')) {
      await db.execAsync("ALTER TABLE internships ADD COLUMN semester INTEGER NOT NULL DEFAULT 3;");
      console.log("✅ Added semester column to internships table");
    }

    // --- NEW MODULE 0 & 2 TABLES ---
    
    // Course Definitions table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS courses_def (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        courseCode TEXT NOT NULL UNIQUE,
        courseName TEXT NOT NULL,
        department TEXT NOT NULL,
        semester INTEGER NOT NULL,
        credits INTEGER DEFAULT 3,
        iseMax INTEGER DEFAULT 20,
        mseMax INTEGER DEFAULT 30,
        eseMax INTEGER DEFAULT 50
      );
    `);

    // Course Assignments table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS course_assignments (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        courseDefId INTEGER NOT NULL,
        teacherPrn TEXT NOT NULL,
        division TEXT NOT NULL,
        isPrimary INTEGER DEFAULT 0,
        FOREIGN KEY (courseDefId) REFERENCES courses_def (id) ON DELETE CASCADE,
        FOREIGN KEY (teacherPrn) REFERENCES users (prn) ON DELETE CASCADE
      );
    `);

    // Academic Records (Marks) table
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS academic_records (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        prn TEXT NOT NULL,
        courseDefId INTEGER NOT NULL,
        semester INTEGER NOT NULL,
        iseMarks INTEGER,
        mseMarks INTEGER,
        eseMarks INTEGER,
        totalMarks INTEGER,
        grade TEXT,
        sgpa REAL,
        cgpa REAL,
        academicYear TEXT,
        FOREIGN KEY (prn) REFERENCES users (prn) ON DELETE CASCADE,
        FOREIGN KEY (courseDefId) REFERENCES courses_def (id) ON DELETE CASCADE
      );
    `);

    // Clean up duplicates before creating unique index
    await db.execAsync(`
      DELETE FROM academic_records 
      WHERE id NOT IN (
        SELECT MIN(id) 
        FROM academic_records 
        GROUP BY prn, courseDefId, semester
      );
    `);

    // Create unique index to prevent future duplicates
    await db.execAsync(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_academic_prn_course_sem 
      ON academic_records (prn, courseDefId, semester);
    `);

    console.log("✅ Database initialized successfully");
  } catch (error) {
    console.error("❌ Database initialization failed:", error);
  }
};

// ============= STUDENT OPERATIONS =============

export const getStudentInfo = async (prn: string): Promise<Student | null> => {
  const db = await dbPromise;
  return await db.getFirstAsync<Student>('SELECT * FROM students WHERE prn = ?', [prn]);
};

export const saveStudentInfo = async (s: Student) => {
  const db = await dbPromise;
  const now = new Date().toISOString();
  return await db.runAsync(
    `INSERT OR REPLACE INTO students (
      prn, fullName, gender, religion, category, caste, dob, branch, division, yearOfStudy, phone, email, aadhar,
      permanentAddress, pincode, temporaryAddress, fatherName, motherName, fatherOccupation,
      motherOccupation, annualIncome, fatherPhone, motherPhone, sscSchool, sscMarks,
      sscMaxMarks, sscPercentage, sscYear, hscCollege, hscMarks, hscMaxMarks, hscPercentage,
      hscYear, diplomaCollege, diplomaMarks, diplomaMaxMarks, diplomaPercentage, diplomaYear,
        diplomaBranch, diplomaBoard, diplomaState, diplomaCity, diplomaCgpa, 
        diplomaPassingMonth, admissionType, jeePercentile, mhtCetPercentile, photoUri, lastUpdated
      ) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        s.prn, s.fullName, s.gender, s.religion, s.category, s.caste, s.dob, s.branch, s.division, s.yearOfStudy, s.phone, s.email, s.aadhar,
        s.permanentAddress, s.pincode, s.temporaryAddress, s.fatherName, s.motherName, s.fatherOccupation,
        s.motherOccupation, s.annualIncome, s.fatherPhone, s.motherPhone, s.sscSchool, s.sscMarks,
        s.sscMaxMarks, s.sscPercentage, s.sscYear, s.hscCollege, s.hscMarks, s.hscMaxMarks, s.hscPercentage,
        s.hscYear, s.diplomaCollege, s.diplomaMarks, s.diplomaMaxMarks, s.diplomaPercentage, s.diplomaYear,
        s.diplomaBranch, s.diplomaBoard, s.diplomaState, s.diplomaCity, s.diplomaCgpa, s.diplomaPassingMonth,
        s.admissionType, s.jeePercentile, s.mhtCetPercentile, s.photoUri, now
      ]
  );
};

// ============= ACHIEVEMENT OPERATIONS =============

export const getAchievements = async (prn: string): Promise<Achievement[]> => {
  const db = await dbPromise;
  return await db.getAllAsync<Achievement>(
    'SELECT * FROM achievements WHERE prn = ? ORDER BY achievementDate DESC',
    [prn]
  );
};

export const saveAchievement = async (a: Achievement) => {
  const db = await dbPromise;
  try {
    const prn = a.prn?.trim();
    if (!prn) throw new Error("PRN is required to save achievement");

    return await db.runAsync(
      `INSERT INTO achievements (prn, semester, achievementName, type, achievementDate, certificateUri, verificationStatus) 
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      [
        prn, 
        a.semester,
        a.achievementName || 'Untitled', 
        a.type || 'Technical', 
        a.achievementDate || new Date().toISOString().split('T')[0],
        a.certificateUri || null,
        'Pending'
      ]
    );
  } catch (error) {
    console.error('SQL Error saving achievement:', error);
    throw error;
  }
};

export const getAchievementsByFilter = async (dept: string, year: string, div: string, sem: number | 'All' = 'All'): Promise<any[]> => {
  const db = await dbPromise;
  let query = `
    SELECT a.*, s.fullName, s.division, s.yearOfStudy
    FROM achievements a
    JOIN students s ON a.prn = s.prn
    WHERE 1=1
  `;
  const params: any[] = [];

  if (dept !== 'All') {
    query += ' AND s.branch = ?';
    params.push(dept);
  }
  if (year !== 'All') {
    query += ' AND s.yearOfStudy = ?';
    params.push(year);
  }
  if (div !== 'All') {
    query += ' AND s.division = ?';
    params.push(div);
  }
  if (sem !== 'All') {
    query += ' AND a.semester = ?';
    params.push(sem);
  }

  query += ' ORDER BY a.achievementDate DESC';
  return await db.getAllAsync<any>(query, params);
};

// ============= STUDENT ACTIVITIES OPERATIONS =============

export const getStudentActivities = async (prn: string): Promise<StudentActivity[]> => {
  const db = await dbPromise;
  return await db.getAllAsync<StudentActivity>(
    'SELECT * FROM student_activities WHERE prn = ? ORDER BY activityDate DESC',
    [prn]
  );
};

export const saveStudentActivity = async (a: StudentActivity) => {
  const db = await dbPromise;
  return await db.runAsync(
    `INSERT INTO student_activities (prn, semester, activityName, type, activityDate, certificateUri, verificationStatus) 
     VALUES (?,?,?,?,?,?,?)`,
    [
      a.prn, a.semester, a.activityName, a.type,
      a.activityDate, a.certificateUri || null, 'Pending'
    ]
  );
};

export const getAllActivitiesByFilter = async (dept: string, year: string, div: string, sem: number | 'All' = 'All', activityType: string = 'All'): Promise<any[]> => {
  const db = await dbPromise;
  
  let query = `
    SELECT a.*, s.fullName, s.division, s.yearOfStudy
    FROM student_activities a
    JOIN students s ON a.prn = s.prn
    WHERE 1=1
  `;
  const params: any[] = [];

  if (dept !== 'All') {
    query += ' AND s.branch = ?';
    params.push(dept);
  }
  if (year !== 'All') {
    query += ' AND s.yearOfStudy = ?';
    params.push(year);
  }
  if (div !== 'All') {
    query += ' AND s.division = ?';
    params.push(div);
  }
  if (sem !== 'All') {
    query += ' AND a.semester = ?';
    params.push(sem);
  }
  if (activityType !== 'All') {
    query += ' AND a.type = ?';
    params.push(activityType);
  }

  query += ' ORDER BY a.activityDate DESC';
  return await db.getAllAsync<any>(query, params);
};

// ============= COURSE OPERATIONS =============

export const getCourses = async (prn: string): Promise<Course[]> => {
  const db = await dbPromise;
  return await db.getAllAsync<Course>(
    'SELECT * FROM courses WHERE prn = ? ORDER BY completionDate DESC',
    [prn]
  );
};

export const saveCourse = async (course: Course) => {
  const db = await dbPromise;
  return await db.runAsync(
    `INSERT INTO courses (prn, courseName, platform, duration, completionDate, certificateUri) 
     VALUES (?,?,?,?,?,?)`,
    [
      course.prn, course.courseName, course.platform, course.duration,
      course.completionDate, course.certificateUri || null
    ]
  );
};

// ============= FEE PAYMENT OPERATIONS =============

export const getFeePayments = async (prn: string): Promise<FeePayment[]> => {
  const db = await dbPromise;
  return await db.getAllAsync<FeePayment>(
    'SELECT * FROM fee_payments WHERE prn = ? ORDER BY academicYear DESC, installmentNumber ASC',
    [prn]
  );
};

export const getTotalFeeForYear = async (prn: string, academicYear: string): Promise<number | null> => {
  const db = await dbPromise;
  const result = await db.getFirstAsync<{ totalFee: number }>(
    'SELECT totalFee FROM fee_payments WHERE prn = ? AND academicYear = ? LIMIT 1',
    [prn, academicYear]
  );
  return result?.totalFee || null;
};

export const getNextInstallmentNumber = async (prn: string, academicYear: string): Promise<number> => {
  const db = await dbPromise;
  const result = await db.getFirstAsync<{ maxInstallment: number }>(
    'SELECT MAX(installmentNumber) as maxInstallment FROM fee_payments WHERE prn = ? AND academicYear = ?',
    [prn, academicYear]
  );
  return (result?.maxInstallment || 0) + 1;
};

export const saveFeePayment = async (payment: FeePayment) => {
  const db = await dbPromise;
  return await db.runAsync(
    `INSERT INTO fee_payments (prn, academicYear, category, totalFee, installmentNumber, 
      paymentDate, amountPaid, remainingBalance, paymentMode, receiptUri) 
     VALUES (?,?,?,?,?,?,?,?,?,?)`,
    [
      payment.prn, payment.academicYear, payment.category, payment.totalFee,
      payment.installmentNumber, payment.paymentDate, payment.amountPaid,
      payment.remainingBalance, payment.paymentMode, payment.receiptUri
    ]
  );
};

// ============= TECHNICAL ACTIVITIES OPERATIONS =============

export const getTechnicalActivities = async (prn: string): Promise<TechnicalActivity[]> => {
  const db = await dbPromise;
  return await db.getAllAsync<TechnicalActivity>(
    'SELECT * FROM technical_activities WHERE prn = ? ORDER BY semester DESC, activityDate DESC',
    [prn]
  );
};

export const saveTechnicalActivity = async (activity: TechnicalActivity) => {
  const db = await dbPromise;
  return await db.runAsync(
    `INSERT INTO technical_activities (prn, semester, academicYear, activityName, 
      activityDate, description, certificateUri) 
     VALUES (?,?,?,?,?,?,?)`,
    [
      activity.prn, activity.semester, activity.academicYear, activity.activityName,
      activity.activityDate, activity.description, activity.certificateUri || null
    ]
  );
};

// ============= NON-TECHNICAL ACTIVITIES OPERATIONS =============

export const getNonTechnicalActivities = async (prn: string): Promise<NonTechnicalActivity[]> => {
  const db = await dbPromise;
  return await db.getAllAsync<NonTechnicalActivity>(
    'SELECT * FROM non_technical_activities WHERE prn = ? ORDER BY semester DESC, activityDate DESC',
    [prn]
  );
};

export const saveNonTechnicalActivity = async (activity: NonTechnicalActivity) => {
  const db = await dbPromise;
  return await db.runAsync(
    `INSERT INTO non_technical_activities (prn, semester, academicYear, activityName, 
      activityDate, description, certificateUri) 
     VALUES (?,?,?,?,?,?,?)`,
    [
      activity.prn, activity.semester, activity.academicYear, activity.activityName,
      activity.activityDate, activity.description, activity.certificateUri || null
    ]
  );
};

// ============= INTERNSHIP OPERATIONS =============

export const calculateDuration = (startDate: string, endDate: string): number => {
  if (!startDate || !endDate) return 0;
  const start = new Date(startDate);
  const end = new Date(endDate);
  if (isNaN(start.getTime()) || isNaN(end.getTime())) return 0;
  
  const months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth());
  return months > 0 ? months : 0;
};

export const getInternships = async (prn: string): Promise<Internship[]> => {
  const db = await dbPromise;
  return await db.getAllAsync<Internship>(
    'SELECT * FROM internships WHERE prn = ? ORDER BY startDate DESC',
    [prn]
  );
};

export const saveInternship = async (internship: Internship) => {
  const db = await dbPromise;
  return await db.runAsync(
    `INSERT INTO internships (prn, semester, companyName, role, internshipType, startDate, 
      endDate, duration, stipend, description, certificateUri) 
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [
      internship.prn, internship.semester, internship.companyName, internship.role, internship.internshipType,
      internship.startDate, internship.endDate, internship.duration, internship.stipend || null,
      internship.description || null, internship.certificateUri || null
    ]
  );
};

// ============= COURSE DEF OPERATIONS =============

export const saveCourseDef = async (c: CourseDef) => {
  const db = await dbPromise;
  return await db.runAsync(
    `INSERT OR REPLACE INTO courses_def (courseCode, courseName, department, semester, credits, iseMax, mseMax, eseMax)
     VALUES (?,?,?,?,?,?,?,?)`,
    [c.courseCode, c.courseName, c.department, c.semester, c.credits, c.iseMax, c.mseMax, c.eseMax]
  );
};

export const getCoursesDefByDept = async (dept: string): Promise<CourseDef[]> => {
  const db = await dbPromise;
  return await db.getAllAsync<CourseDef>('SELECT * FROM courses_def WHERE department = ?', [dept]);
};

export const getAllCoursesDef = async (): Promise<CourseDef[]> => {
  const db = await dbPromise;
  return await db.getAllAsync<CourseDef>('SELECT * FROM courses_def');
};

// ============= ACADEMIC RECORD OPERATIONS =============

export const saveAcademicRecord = async (r: AcademicRecord) => {
  const db = await dbPromise;
  return await db.runAsync(
    `INSERT OR REPLACE INTO academic_records (prn, courseDefId, semester, iseMarks, mseMarks, eseMarks, totalMarks, grade, sgpa, cgpa, academicYear)
     VALUES (?,?,?,?,?,?,?,?,?,?,?)`,
    [r.prn, r.courseDefId, r.semester, r.iseMarks, r.mseMarks, r.eseMarks, r.totalMarks, r.grade, r.sgpa, r.cgpa, r.academicYear]
  );
};

export const getAcademicRecordsByStudent = async (prn: string): Promise<any[]> => {
  const db = await dbPromise;
  return await db.getAllAsync<any>(
    `SELECT ar.*, c.courseName, c.courseCode, c.credits, c.iseMax, c.mseMax, c.eseMax
     FROM academic_records ar
     JOIN courses_def c ON ar.courseDefId = c.id
     WHERE ar.prn = ?
     ORDER BY ar.semester ASC, c.courseName ASC`,
    [prn]
  );
};

export const getAcademicRecordsByFilter = async (dept: string, year: string, div: string, sem: number): Promise<any[]> => {
  const db = await dbPromise;
  return await db.getAllAsync<any>(
    `SELECT ar.*, s.fullName, s.division, c.courseName, c.courseCode 
     FROM academic_records ar
     JOIN students s ON ar.prn = s.prn
     JOIN courses_def c ON ar.courseDefId = c.id
     WHERE s.branch = ? AND s.yearOfStudy = ? AND s.division = ? AND ar.semester = ?`,
    [dept, year, div, sem]
  );
};

export const getAllInternshipsByFilter = async (dept: string, year: string, div: string, sem: number | 'All' = 'All'): Promise<any[]> => {
  const db = await dbPromise;
  
  let query = `
    SELECT i.*, s.fullName, s.division, s.yearOfStudy
    FROM internships i
    JOIN students s ON i.prn = s.prn
    WHERE 1=1
  `;
  const params: any[] = [];

  if (dept !== 'All') {
    query += ' AND s.branch = ?';
    params.push(dept);
  }
  if (year !== 'All') {
    query += ' AND s.yearOfStudy = ?';
    params.push(year);
  }
  if (div !== 'All') {
    query += ' AND s.division = ?';
    params.push(div);
  }
  if (sem !== 'All') {
    query += ' AND i.semester = ?';
    params.push(sem);
  }

  return await db.getAllAsync<any>(query, params);
};

export const getFeePaymentsByFilter = async (dept: string, year: string, div: string): Promise<any[]> => {
  const db = await dbPromise;
  
  let query = `
    SELECT s.prn, s.fullName, s.yearOfStudy, s.permanentAddress, s.temporaryAddress,
           f.id, 
           COALESCE(f.totalFee, 50000) as totalFee, 
           COALESCE(f.amountPaid, 0) as paidAmount, 
           COALESCE(f.remainingBalance, 50000) as lastBalance,
           f.receiptUri, f.verificationStatus, f.paymentDate, f.installmentNumber
    FROM students s
    LEFT JOIN (
      SELECT * FROM fee_payments 
      WHERE id IN (SELECT MAX(id) FROM fee_payments GROUP BY prn)
    ) f ON s.prn = f.prn
    WHERE 1=1
  `;
  const params: any[] = [];

  if (dept !== 'All') {
    query += ' AND s.branch = ?';
    params.push(dept);
  }
  if (year !== 'All') {
    query += ' AND s.yearOfStudy = ?';
    params.push(year);
  }
  if (div !== 'All') {
    query += ' AND s.division = ?';
    params.push(div);
  }

  query += ' ORDER BY s.fullName ASC';

  return await db.getAllAsync<any>(query, params);
};

export const getFeeAnalytics = async (dept: string, year: string, div: string) => {
  const db = await dbPromise;
  
  let query = `
    SELECT 
      COUNT(DISTINCT s.prn) as totalStudents,
      SUM(CASE WHEN COALESCE(f.remainingBalance, 50000) > 0 THEN 1 ELSE 0 END) as studentsWithRemaining,
      SUM(COALESCE(f.remainingBalance, 50000)) as totalRemainingAmount
    FROM students s
    LEFT JOIN (
      SELECT prn, remainingBalance 
      FROM fee_payments 
      WHERE id IN (SELECT MAX(id) FROM fee_payments GROUP BY prn)
    ) f ON s.prn = f.prn
    WHERE 1=1
  `;
  const params: any[] = [];

  if (dept !== 'All') {
    query += ' AND s.branch = ?';
    params.push(dept);
  }
  if (year !== 'All') {
    query += ' AND s.yearOfStudy = ?';
    params.push(year);
  }
  if (div !== 'All') {
    query += ' AND s.division = ?';
    params.push(div);
  }

  return await db.getFirstAsync<any>(query, params);
};

export const getAllStudents = async (): Promise<Student[]> => {
  const db = await dbPromise;
  return await db.getAllAsync<Student>('SELECT * FROM students ORDER BY fullName ASC');
};

export const updateVerificationStatus = async (
  table: 'students' | 'fee_payments' | 'student_activities' | 'internships' | 'achievements',
  id: string | number,
  status: 'Pending' | 'Verified' | 'Rejected',
  verifiedBy: string
) => {
  const db = await dbPromise;
  const idColumn = table === 'students' ? 'prn' : 'id';
  return await db.runAsync(
    `UPDATE ${table} SET verificationStatus = ?, verifiedBy = ? WHERE ${idColumn} = ?`,
    [status, verifiedBy, id]
  );
};

export const getStudentRecords = async (prn: string) => {
  const db = await dbPromise;
  const student = await getStudentInfo(prn);
  const feePayments = await getFeePayments(prn);
  const activities = await getStudentActivities(prn);
  const achievements = await getAchievements(prn);
  const internships = await getInternships(prn);

  return {
    student,
    feePayments,
    activities,
    achievements,
    internships,
  };
};

export const getAllDocuments = async (prn: string): Promise<any[]> => {
  const db = await dbPromise;
  const docs: any[] = [];

  // 1. Fee Receipts
  const fees = await db.getAllAsync<any>('SELECT receiptUri, academicYear, paymentDate, amountPaid FROM fee_payments WHERE prn = ? AND receiptUri IS NOT NULL', [prn]);
  fees.forEach(f => docs.push({
    title: `Fee Receipt - ${f.academicYear}`,
    uri: f.receiptUri,
    date: f.paymentDate,
    category: 'Fees',
    details: `Amount: ₹${f.amountPaid}`
  }));

  // 2. Achievement Certificates
  const achievements = await db.getAllAsync<any>('SELECT certificateUri, achievementName, type, achievementDate FROM achievements WHERE prn = ? AND certificateUri IS NOT NULL', [prn]);
  achievements.forEach(a => docs.push({
    title: a.achievementName,
    uri: a.certificateUri,
    date: a.achievementDate,
    category: 'Achievement',
    details: a.type
  }));

  // 3. Activity Certificates
  const acts = await db.getAllAsync<any>('SELECT certificateUri, activityName, type, activityDate FROM student_activities WHERE prn = ? AND certificateUri IS NOT NULL', [prn]);
  acts.forEach(t => docs.push({
    title: t.activityName,
    uri: t.certificateUri,
    date: t.activityDate,
    category: t.type,
    details: t.type
  }));

  // 4. Course Certificates
  const courses = await db.getAllAsync<any>('SELECT certificateUri, courseName, completionDate FROM courses WHERE prn = ? AND certificateUri IS NOT NULL', [prn]);
  courses.forEach(c => docs.push({
    title: c.courseName,
    uri: c.certificateUri,
    date: c.completionDate,
    category: 'Course',
    details: 'Completed'
  }));

  // 5. Internship Certificates
  const internships = await db.getAllAsync<any>('SELECT certificateUri, companyName, role, startDate FROM internships WHERE prn = ? AND certificateUri IS NOT NULL', [prn]);
  internships.forEach(i => docs.push({
    title: `Internship - ${i.companyName}`,
    uri: i.certificateUri,
    date: i.startDate,
    category: 'Internship',
    details: i.role
  }));

  return docs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
};

// ============= FACULTY OPERATIONS =============

export interface FacultyMember {
  prn: string;
  fullName: string;
  role: string;
  isProfileComplete: number;
}

export const getFacultyMembers = async (): Promise<FacultyMember[]> => {
  const db = await dbPromise;
  return await db.getAllAsync<FacultyMember>("SELECT prn, role, isProfileComplete FROM users WHERE role = 'teacher' ORDER BY prn ASC");
};

export const saveFacultyMember = async (prn: string, password: string) => {
  const db = await dbPromise;
  return await db.runAsync(
    'INSERT OR REPLACE INTO users (prn, password, role, isProfileComplete) VALUES (?, ?, ?, ?)',
    [prn, password, 'teacher', 1]
  );
};

export const deleteFacultyMember = async (prn: string) => {
  const db = await dbPromise;
  return await db.runAsync('DELETE FROM users WHERE prn = ? AND role = ?', [prn, 'teacher']);
};

export const getAcademicYearFromSemester = (semester: number): string => {
  const year = Math.ceil(semester / 2);
  const suffix = ['st', 'nd', 'rd', 'th'];
  return `${year}${suffix[year - 1] || 'th'} Year`;
};