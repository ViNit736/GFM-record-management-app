import * as SQLite from 'expo-sqlite';
import { Platform } from 'react-native';
import { supabase } from '../services/supabase';

const generateUUID = (): string => {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

// Helper to open database safely
const openDatabaseSafely = () => {
  if (Platform.OS === 'web') {
    // On Web, SQLite (via OPFS) doesn't allow multiple tabs to access the same DB file.
    // If it's already open in another tab, it throws NoModificationAllowedError.
    // We wrap it in a promise that resolves to null on failure so the app continues.
    return (async () => {
      try {
        // We use a small timeout to let any previous tab finish if it's just reloading
        return await SQLite.openDatabaseAsync('gfm_record.db');
      } catch (e: any) {
        if (e.name === 'NoModificationAllowedError' || e.message?.includes('Access Handles')) {
          console.warn('⚠️ SQLite access denied (possibly open in another tab). Falling back to Supabase-only mode.');
        } else {
          console.warn('⚠️ SQLite initialization failed:', e);
        }
        return null;
      }
    })();
  }

  try {
    return SQLite.openDatabaseAsync('gfm_record.db');
  } catch (e) {
    console.warn('⚠️ SQLite pre-initialization failed:', e);
    return null as any;
  }
};

export const dbPromise = openDatabaseSafely();

// ============= INTERFACES =============

export interface Student {
  prn: string;
  fullName: string;
  rollNo: string;
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
  gfmId?: string;
  gfmName?: string;
  lastUpdated?: string;
  verificationStatus?: string;
  verifiedBy?: string;
}

export interface TeacherProfile {
  id: string;
  fullName: string;
  department: string;
  email: string;
}

export interface Achievement {
  id?: number;
  prn: string;
  semester: number;
  academicYear?: string;
  achievementName: string;
  type: string;
  achievementDate: string;
  description?: string;
  certificateUri?: string;
  verificationStatus?: string;
  verifiedBy?: string;
  createdAt?: string;
}

export interface Course {
  id?: number;
  prn: string;
  academicYear?: string;
  courseName: string;
  platform: string;
  duration: string;
  completionDate: string;
  description?: string;
  certificateUri?: string;
  verificationStatus?: string;
  verifiedBy?: string;
  createdAt?: string;
}

export interface StudentActivity {
  id?: number;
  prn: string;
  semester: number;
  academicYear?: string;
  activityName: string;
  type: 'Extra-curricular' | 'Co-curricular' | 'Courses';
  activityDate: string;
  description?: string;
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
  yearOfStudy: string;
}

export interface FacultyMember {
  prn: string;
  fullName?: string;
  department?: string;
  email?: string;
  role: string;
  isProfileComplete: boolean;
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

// ============= MAPPING UTILITIES =============

export const toSnakeCase = (obj: any) => {
  const newObj: any = {};
  for (const key in obj) {
    const snakeKey = key.replace(/[A-Z]/g, letter => `_${letter.toLowerCase()}`);
    newObj[snakeKey] = obj[key];
  }
  return newObj;
};

export const toCamelCase = (obj: any) => {
  const newObj: any = {};
  for (const key in obj) {
    const camelKey = key.replace(/([-_][a-z])/g, group =>
      group.toUpperCase().replace('-', '').replace('_', '')
    );
    newObj[camelKey] = obj[key];
  }
  return newObj;
};

let dbInitDone = false;
let dbInitInProgress = false;
let dbInitPromise: Promise<void> | null = null;

export const initDB = async () => {
  if (dbInitDone) return;
  if (dbInitInProgress) return dbInitPromise || Promise.resolve();

  dbInitInProgress = true;
  dbInitPromise = (async () => {
    try {
      const db = await dbPromise;
      if (!db) throw new Error('SQLite database not available');

      // 1. Session Table (Cached Session)
      await db.runAsync(`
      CREATE TABLE IF NOT EXISTS session (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        role TEXT,
        prn TEXT,
        email TEXT,
        isProfileComplete INTEGER,
        access_token TEXT,
        refresh_token TEXT,
        updatedAt INTEGER
      );
    `);

      // 2. Users Cache (Cached User Profiles)
      await db.runAsync(`
      CREATE TABLE IF NOT EXISTS users(
        id TEXT PRIMARY KEY,
        username TEXT,
        role TEXT,
        data TEXT,
        updatedAt INTEGER
      );
      `);

      // 3. Attendance Cache
      await db.runAsync(`
      CREATE TABLE IF NOT EXISTS attendance_cache(
        key TEXT PRIMARY KEY,
        data TEXT,
        updatedAt INTEGER
      );
      `);

      // 4. Students Cache
      await db.runAsync(`
      CREATE TABLE IF NOT EXISTS cached_students(
        prn TEXT PRIMARY KEY,
        full_name TEXT,
        roll_no TEXT,
        data TEXT,
        updatedAt INTEGER
      );
      `);

      // 5. Courses Definition Cache
      await db.runAsync(`
      CREATE TABLE IF NOT EXISTS courses_def(
        id INTEGER PRIMARY KEY,
        course_code TEXT,
        course_name TEXT,
        department TEXT,
        semester INTEGER,
        credits INTEGER,
        ise_max INTEGER,
        mse_max INTEGER,
        ese_max INTEGER,
        year_of_study TEXT
      );
      `);

      console.log('✅ SQLite (Cache Layer) initialized successfully');
      dbInitDone = true;
    } catch (error) {
      console.error('❌ SQLite Init Error:', error);
      // On web, we don't want to block the app if SQLite fails,
      // as it is only a cache layer.
      if (Platform.OS !== 'web') throw error;
    } finally {
      dbInitInProgress = false;
    }
  })();

  return dbInitPromise;
};

export const clearSQLite = async () => {
  try {
    const db = await dbPromise;
    if (!db) return;

    // Check if tables exist before deleting
    await db.runAsync('DROP TABLE IF EXISTS session');
    await db.runAsync('DROP TABLE IF EXISTS users');

    dbInitDone = false;
    await initDB();
    console.log('🔥 SQLite cache cleared');
  } catch (e) {
    console.warn('SQLite clear warning (non-critical):', e);
  }
};

// ============= STUDENT OPERATIONS (SUPABASE ONLY) =============

export const getStudentInfo = async (prn: string): Promise<Student | null> => {
  const db = await dbPromise;

  // 1. Try Cache
  try {
    const cached = await db.getFirstAsync(
      'SELECT data, updatedAt FROM cached_students WHERE prn = ?',
      [prn]
    ) as { data: string, updatedAt: number } | null;

    // Return cache if fresh (e.g., less than 5 minutes old)
    if (cached && (Date.now() - cached.updatedAt < 5 * 60 * 1000)) {
      return JSON.parse(cached.data);
    }
  } catch (e) { console.warn('Cache read failed:', e); }

  // 2. Fetch from Supabase
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('prn', prn)
    .single();

  if (error || !data) return null;
  const student = toCamelCase(data) as Student;

  // 3. Update Cache
  try {
    await db.runAsync(
      `INSERT OR REPLACE INTO cached_students(prn, full_name, roll_no, data, updatedAt) VALUES(?, ?, ?, ?, ?)`,
      [prn, student.fullName, student.rollNo, JSON.stringify(student), Date.now()]
    );
  } catch (e) { console.warn('Cache write failed:', e); }

  return student;
};

export const saveStudentInfo = async (s: Student) => {
  const snakeData = toSnakeCase(s);
  snakeData.last_updated = new Date().toISOString();

  console.log('📝 Saving student info:', JSON.stringify(snakeData, null, 2));

  const { data, error } = await supabase
    .from('students')
    .upsert(snakeData, { onConflict: 'prn' })
    .select();

  if (error) {
    console.error('❌ Error saving student info:', error);
    throw error;
  }

  // 2. Update Local Cache immediately
  try {
    const db = await dbPromise;
    if (db) {
      await db.runAsync(
        `INSERT OR REPLACE INTO cached_students(prn, full_name, roll_no, data, updatedAt) VALUES(?, ?, ?, ?, ?)`,
        [s.prn, s.fullName, s.rollNo, JSON.stringify(s), Date.now()]
      );
      console.log('📦 Local student cache updated');
    }
  } catch (e) {
    console.warn('⚠️ Local cache update failed:', e);
  }

  console.log('✅ Student info saved successfully:', data);
  return data;
};

// ============= ACHIEVEMENT OPERATIONS (SUPABASE ONLY) =============

export const getAchievements = async (prn: string): Promise<Achievement[]> => {
  const { data, error } = await supabase
    .from('achievements')
    .select('*')
    .eq('prn', prn)
    .order('achievement_date', { ascending: false });

  if (error) return [];
  return data.map(toCamelCase) as Achievement[];
};

export const saveAchievement = async (a: Achievement) => {
  const snakeData = toSnakeCase(a);
  if (snakeData.id === undefined) delete snakeData.id;

  const { error } = await supabase
    .from('achievements')
    .insert(snakeData);

  if (error) throw error;
};

export const getAchievementsByFilter = async (dept: string, year: string, div: string, sem: number | 'All' = 'All'): Promise<any[]> => {
  let query = supabase
    .from('achievements')
    .select(`
        *,
        students!inner(
          full_name,
          division,
          year_of_study,
          branch
        )
          `);

  if (dept !== 'All') query = query.eq('students.branch', dept);
  if (year !== 'All') query = query.eq('students.year_of_study', year);
  if (div !== 'All') query = query.eq('students.division', div);
  if (sem !== 'All') query = query.eq('semester', sem);

  const { data, error } = await query.order('achievement_date', { ascending: false });
  if (error) return [];

  return data.map(item => ({
    ...toCamelCase(item),
    fullName: item.students.full_name,
    division: item.students.division,
    yearOfStudy: item.students.year_of_study
  }));
};

// ============= STUDENT ACTIVITIES OPERATIONS (SUPABASE ONLY) =============

export const getStudentActivities = async (prn: string): Promise<StudentActivity[]> => {
  const { data, error } = await supabase
    .from('student_activities')
    .select('*')
    .eq('prn', prn)
    .order('activity_date', { ascending: false });

  if (error) return [];
  return data.map(toCamelCase) as StudentActivity[];
};

export const saveStudentActivity = async (a: StudentActivity) => {
  const snakeData = toSnakeCase(a);
  if (snakeData.id === undefined) delete snakeData.id;

  const { error } = await supabase
    .from('student_activities')
    .insert(snakeData);

  if (error) throw error;
};

export const getAllActivitiesByFilter = async (dept: string, year: string, div: string, sem: number | 'All' = 'All', activityType: string = 'All'): Promise<any[]> => {
  let query = supabase
    .from('student_activities')
    .select(`
          *,
          students!inner(
            full_name,
            division,
            year_of_study,
            branch
          )
            `);

  if (dept !== 'All') query = query.eq('students.branch', dept);
  if (year !== 'All') query = query.eq('students.year_of_study', year);
  if (div !== 'All') query = query.eq('students.division', div);
  if (sem !== 'All') query = query.eq('semester', sem);
  if (activityType !== 'All') query = query.eq('type', activityType);

  const { data, error } = await query.order('activity_date', { ascending: false });
  if (error) return [];

  return data.map(item => ({
    ...toCamelCase(item),
    fullName: item.students.full_name,
    division: item.students.division,
    yearOfStudy: item.students.year_of_study
  }));
};

// ============= COURSE OPERATIONS (SUPABASE ONLY) =============

export const getCourses = async (prn: string): Promise<Course[]> => {
  const { data, error } = await supabase
    .from('courses')
    .select('*')
    .eq('prn', prn)
    .order('completion_date', { ascending: false });

  if (error) return [];
  return data.map(toCamelCase) as Course[];
};

export const saveCourse = async (course: Course) => {
  const snakeData = toSnakeCase(course);
  if (snakeData.id === undefined) delete snakeData.id;

  const { error } = await supabase
    .from('courses')
    .insert(snakeData);

  if (error) throw error;
};

// ============= FEE PAYMENT OPERATIONS (SUPABASE ONLY) =============

export const getFeePayments = async (prn: string): Promise<FeePayment[]> => {
  const { data, error } = await supabase
    .from('fee_payments')
    .select('*')
    .eq('prn', prn)
    .order('academic_year', { ascending: false })
    .order('installment_number', { ascending: true });

  if (error) return [];
  return data.map(toCamelCase) as FeePayment[];
};

export const getTotalFeeForYear = async (prn: string, academicYear: string): Promise<number | null> => {
  const { data, error } = await supabase
    .from('fee_payments')
    .select('total_fee')
    .eq('prn', prn)
    .eq('academic_year', academicYear)
    .limit(1)
    .maybeSingle();

  if (error || !data) return null;
  return data.total_fee;
};

export const getNextInstallmentNumber = async (prn: string, academicYear: string): Promise<number> => {
  const { data, error } = await supabase
    .from('fee_payments')
    .select('installment_number')
    .eq('prn', prn)
    .eq('academic_year', academicYear)
    .order('installment_number', { ascending: false })
    .limit(1);

  if (error || !data || data.length === 0) return 1;
  return (data[0].installment_number || 0) + 1;
};

export const saveFeePayment = async (payment: FeePayment) => {
  const snakeData = toSnakeCase(payment);
  if (snakeData.id === undefined) delete snakeData.id;
  delete snakeData.created_at;

  const { data, error } = await supabase
    .from('fee_payments')
    .insert(snakeData)
    .select();

  if (error) throw error;
  return data;
};

// ============= INTERNSHIP OPERATIONS (SUPABASE ONLY) =============

export const getInternships = async (prn: string): Promise<Internship[]> => {
  const { data, error } = await supabase
    .from('internships')
    .select('*')
    .eq('prn', prn)
    .order('start_date', { ascending: false });

  if (error) return [];
  return data.map(toCamelCase) as Internship[];
};

export const saveInternship = async (internship: Internship) => {
  const snakeData = toSnakeCase(internship);
  if (snakeData.id === undefined) delete snakeData.id;

  const { error } = await supabase
    .from('internships')
    .insert(snakeData);

  if (error) throw error;
};

export const getAllInternshipsByFilter = async (dept: string, year: string, div: string, sem: number | 'All' = 'All'): Promise<any[]> => {
  let query = supabase
    .from('internships')
    .select(`
            *,
            students!inner(
              full_name,
              division,
              year_of_study,
              branch
            )
              `);

  if (dept !== 'All') query = query.eq('students.branch', dept);
  if (year !== 'All') query = query.eq('students.year_of_study', year);
  if (div !== 'All') query = query.eq('students.division', div);
  if (sem !== 'All') query = query.eq('semester', sem);

  const { data, error } = await query.order('start_date', { ascending: false });
  if (error) return [];

  return data.map(item => ({
    ...toCamelCase(item),
    fullName: item.students.full_name,
    division: item.students.division,
    yearOfStudy: item.students.year_of_study
  }));
};

// ============= ACADEMIC RECORD OPERATIONS (SUPABASE ONLY) =============

export const getAcademicRecordsByStudent = async (prn: string): Promise<any[]> => {
  const { data, error } = await supabase
    .from('academic_records')
    .select(`
              *,
              courses_def!inner(
                course_name,
                course_code,
                credits,
                ise_max,
                mse_max,
                ese_max
              )
                `)
    .eq('prn', prn)
    .order('semester', { ascending: true });

  if (error) return [];

  return data.map(item => ({
    ...toCamelCase(item),
    courseName: item.courses_def.course_name,
    courseCode: item.courses_def.course_code,
    credits: item.courses_def.credits,
    iseMax: item.courses_def.ise_max,
    mseMax: item.courses_def.mse_max,
    eseMax: item.courses_def.ese_max
  }));
};

export const getAcademicRecordsByFilter = async (dept: string, year: string, div: string, sem: number | 'All' = 'All'): Promise<any[]> => {
  let query = supabase
    .from('academic_records')
    .select(`
                *,
                students!inner(
                  full_name,
                  branch,
                  year_of_study,
                  division
                ),
                  courses_def!inner(
                    course_name,
                    course_code
                  )
                    `);

  if (dept !== 'All') query = query.eq('students.branch', dept);
  if (year !== 'All') query = query.eq('students.year_of_study', year);
  if (div !== 'All') query = query.eq('students.division', div);
  if (sem !== 'All') query = query.eq('semester', sem);

  const { data, error } = await query;
  if (error) return [];

  return data.map(item => ({
    ...toCamelCase(item),
    fullName: item.students.full_name,
    courseName: item.courses_def.course_name,
    courseCode: item.courses_def.course_code
  }));
};

export const saveAcademicRecord = async (record: AcademicRecord) => {
  const snakeData = toSnakeCase(record);
  if (snakeData.id === undefined) delete snakeData.id;

  const { error } = await supabase
    .from('academic_records')
    .upsert(snakeData);

  if (error) throw error;
};

export const getFeePaymentsByFilter = async (dept: string, year: string, div: string): Promise<any[]> => {
  try {
    // Build Supabase query
    let query = supabase
      .from('students')
      .select(`
      prn,
        full_name,
        roll_no,
        year_of_study,
        branch,
        division,
        permanent_address,
        temporary_address,
        fee_payments(
          id,
          total_fee,
          amount_paid,
          remaining_balance,
          receipt_uri,
          verification_status,
          payment_date,
          installment_number,
          academic_year
        )
          `);

    // Apply filters
    if (dept !== 'All') query = query.eq('branch', dept);
    if (year !== 'All') query = query.eq('year_of_study', year);
    if (div !== 'All') query = query.eq('division', div);

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching fee payments:', error);
      return [];
    }

    // Sort by last 3 digits of PRN
    const sortedData = (data || []).sort((a, b) => {
      const aSeq = parseInt(a.prn.slice(-3)) || 0;
      const bSeq = parseInt(b.prn.slice(-3)) || 0;
      return aSeq - bSeq;
    });

    // Transform data to expected format
    return sortedData.map(student => {
      const payments = (student.fee_payments as any[]) || [];
      const latestPayment = payments.sort((a, b) => b.id - a.id)[0] || {};

      return {
        prn: student.prn,
        fullName: student.full_name,
        rollNo: student.roll_no,
        yearOfStudy: student.year_of_study,
        permanentAddress: student.permanent_address,
        temporaryAddress: student.temporary_address,
        totalFee: latestPayment.total_fee || 50000,
        paidAmount: latestPayment.amount_paid || 0,
        lastBalance: latestPayment.remaining_balance || 50000,
        receiptUri: latestPayment.receipt_uri,
        verificationStatus: latestPayment.verification_status,
        paymentDate: latestPayment.payment_date,
        installmentNumber: latestPayment.installment_number
      };
    });
  } catch (error) {
    console.error('Error in getFeePaymentsByFilter:', error);
    return [];
  }
};

export const getFeeAnalytics = async (dept: string, year: string, div: string) => {
  let query = supabase
    .from('students')
    .select(`
      prn,
        branch,
        year_of_study,
        division,
        fee_payments(
          id,
          amount_paid,
          remaining_balance,
          total_fee
        )
          `);

  if (dept !== 'All') query = query.eq('branch', dept);
  if (year !== 'All') query = query.eq('year_of_study', year);
  if (div !== 'All') query = query.eq('division', div);

  const { data, error } = await query;
  if (error || !data) return { totalStudents: 0, studentsWithRemaining: 0, totalRemainingAmount: 0 };

  let studentsWithRemaining = 0;
  let totalRemainingAmount = 0;

  data.forEach(student => {
    const payments = (student.fee_payments as any[]) || [];
    if (payments.length > 0) {
      const latestPayment = payments.sort((a, b) => b.id - a.id)[0];
      const balance = latestPayment.remaining_balance || 0;
      if (balance > 0) {
        studentsWithRemaining++;
        totalRemainingAmount += balance;
      }
    }
  });

  return {
    totalStudents: data.length,
    studentsWithRemaining,
    totalRemainingAmount
  };
};

export const getAllCoursesDef = async (): Promise<CourseDef[]> => {
  const db = await dbPromise;

  // 1. Try Cache
  try {
    const cached = await db.getAllAsync('SELECT * FROM courses_def');
    if (cached && cached.length > 0) {
      return cached.map(toCamelCase) as CourseDef[];
    }
  } catch (e) {
    console.warn('Cache read failed for courses_def:', e);
  }

  // 2. Fetch from Supabase
  const { data, error } = await supabase
    .from('courses_def')
    .select('*')
    .order('course_name');

  if (error) {
    console.error('❌ Error fetching courses_def:', error);
    throw error;
  }

  // 3. Update Local Cache immediately
  try {
    if (db) {
      await db.runAsync('DELETE FROM courses_def');
      for (const c of data) {
        await db.runAsync(
          'INSERT INTO courses_def (id, course_code, course_name, department, semester, credits, ise_max, mse_max, ese_max, year_of_study) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
          [c.id, c.course_code, c.course_name, c.department, c.semester, c.credits, c.ise_max, c.mse_max, c.ese_max, c.year_of_study]
        );
      }
    }
    return data.map(toCamelCase) as CourseDef[];
  } catch (e) {
    console.warn('⚠️ Local cache update failed:', e);
    // If cache update fails, still return the fetched data
    return data.map(toCamelCase) as CourseDef[];
  }
};

export const saveCourseDef = async (course: CourseDef) => {
  const snakeData = toSnakeCase(course);
  if (snakeData.id === undefined) delete snakeData.id;

  const { error } = await supabase
    .from('courses_def')
    .upsert(snakeData);

  if (error) throw error;
};

export const getAllStudents = async (): Promise<Student[]> => {
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .order('full_name', { ascending: true });

  if (error) return [];
  return data.map(toCamelCase) as Student[];
};

export const getDistinctYearsOfStudy = async (): Promise<string[]> => {
  const { data, error } = await supabase
    .from('students')
    .select('year_of_study')
    .order('year_of_study', { ascending: true });

  if (error || !data) return ['FE', 'SE', 'TE', 'BE'];

  const dbYears = data.map(item => item.year_of_study).filter(Boolean);
  // Return raw keys (FE, SE, etc.) to ensure DB queries match
  const years = Array.from(new Set(['FE', 'SE', 'TE', 'BE', ...dbYears])).sort();
  return years as string[];
};

export const updateVerificationStatus = async (
  table: 'students' | 'fee_payments' | 'student_activities' | 'internships' | 'achievements',
  id: string | number,
  status: 'Pending' | 'Verified' | 'Rejected',
  verifiedBy: string
) => {
  const idColumn = table === 'students' ? 'prn' : 'id';
  const { error } = await supabase
    .from(table)
    .update({
      verification_status: status,
      verified_by: verifiedBy
    })
    .eq(idColumn, id);

  if (error) throw error;
};

// ============= FACULTY & ATTENDANCE TAKER OPERATIONS (SUPABASE ONLY) =============

export const getFacultyMembers = async (): Promise<FacultyMember[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('prn, role, full_name, department, email')
    .eq('role', 'teacher')
    .order('prn', { ascending: true });

  if (error) return [];
  return data.map(item => ({
    prn: item.prn,
    fullName: item.full_name,
    department: item.department,
    email: item.email,
    role: item.role,
    isProfileComplete: true
  })) as FacultyMember[];
};

export const getAttendanceTakers = async (): Promise<FacultyMember[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('prn, role, full_name, department, email')
    .eq('role', 'attendance_taker')
    .order('prn', { ascending: true });

  if (error) return [];
  return data.map(item => ({
    prn: item.prn,
    fullName: item.full_name,
    department: item.department,
    email: item.email,
    role: item.role,
    isProfileComplete: true
  })) as FacultyMember[];
};

export const saveFacultyMember = async (prn: string, password: string, fullName?: string, department?: string, email?: string) => {
  const id = generateUUID();
  const { error } = await supabase
    .from('profiles')
    .insert({
      id,
      prn,
      role: 'teacher',
      email: email || `${prn.toLowerCase()}@gfm.com`,
      full_name: fullName || `Faculty ${prn}`,
      department: department || null,
      password: password
    });

  if (error) throw error;
};

export const saveAttendanceTaker = async (prn: string, password: string, fullName?: string, department?: string, email?: string) => {
  const id = generateUUID();
  const { error } = await supabase
    .from('profiles')
    .insert({
      id,
      prn,
      role: 'attendance_taker',
      email: email || `${prn.toLowerCase()}@at.com`,
      full_name: fullName || `Taker ${prn}`,
      department: department || null,
      password: password
    });

  if (error) throw error;
};

export const deleteFacultyMember = async (prn: string) => {
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('prn', prn);

  if (error) throw error;
};

export const deleteAttendanceTaker = async (prn: string) => {
  const { error } = await supabase
    .from('profiles')
    .delete()
    .eq('prn', prn);

  if (error) throw error;
};

export const deleteStudent = async (prn: string) => {
  // 1. Delete from profiles (login)
  const { error: profileError } = await supabase
    .from('profiles')
    .delete()
    .eq('prn', prn);

  if (profileError) console.error('Error deleting student profile:', profileError);

  // 2. Delete from students table
  const { error: studentError } = await supabase
    .from('students')
    .delete()
    .eq('prn', prn);

  if (studentError) throw studentError;

  // 3. Clear from local cache
  const db = await dbPromise;
  if (db) {
    await db.runAsync('DELETE FROM cached_students WHERE prn = ?', [prn]);
  }
};

export const deleteBatchAllocation = async (id: string) => {
  const { error } = await supabase
    .from('teacher_batch_configs')
    .delete()
    .eq('id', id);

  if (error) {
    console.error('Error deleting batch allocation:', error);
    throw error;
  }
};

export const deleteBatchDefinition = async (id: string) => {
  try {
    console.log('🗑️ Starting batch deletion for ID:', id);

    // Attendance sessions use batch_name (text) not batch_definition_id (FK)
    // So they are completely independent and don't need updating!
    console.log('ℹ️ Attendance data is independent (no FK relationship)');

    // Step 1: Delete GFM assignments (teacher_batch_configs)
    const { error: configError } = await supabase
      .from('teacher_batch_configs')
      .delete()
      .eq('batch_definition_id', id);

    if (configError) {
      console.error('❌ Error deleting teacher batch configs:', configError);
      throw new Error(`Failed to delete teacher assignments: ${configError.message}`);
    }
    console.log('✅ Deleted teacher batch configs');

    // Step 2: Delete the batch definition itself
    const { error: batchError } = await supabase
      .from('batch_definitions')
      .delete()
      .eq('id', id);

    if (batchError) {
      console.error('❌ Error deleting batch definition:', batchError);
      throw new Error(`Failed to delete batch: ${batchError.message}`);
    }

    console.log('✅ Batch definition deleted successfully (attendance data is independent and preserved)');
  } catch (error: any) {
    console.error('❌ Batch deletion failed:', error);
    throw error;
  }
};

export const getAllTeachers = async (): Promise<TeacherProfile[]> => {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, full_name, department, email')
    .eq('role', 'teacher')
    .order('full_name', { ascending: true });

  if (error) return [];
  return data.map(item => ({
    id: item.id,
    fullName: item.full_name,
    department: item.department,
    email: item.email
  })) as TeacherProfile[];
};

export const saveStudent = async (student: Partial<Student>) => {
  const snakeData = toSnakeCase(student);

  // 1. Insert into students table
  const { error: studentError } = await supabase
    .from('students')
    .insert(snakeData);

  if (studentError) throw studentError;

  // 2. Also create a profile for login (PRN as password initially)
  const id = generateUUID();
  const { error: profileError } = await supabase
    .from('profiles')
    .insert({
      id,
      email: student.email,
      prn: student.prn,
      full_name: student.fullName,
      role: 'student',
      password: student.prn
    });

  if (profileError) {
    console.error('Error creating student profile:', profileError);
  }
};

// ============= UTILITY FUNCTIONS =============

export const getAcademicYearFromSemester = (semester: number): string => {
  if (semester <= 2) return 'FE';
  if (semester <= 4) return 'SE';
  if (semester <= 6) return 'TE';
  return 'BE';
};

// ============= ATTENDANCE OPERATIONS (SUPABASE + SQLITE CACHE) =============

export interface TeacherBatchConfig {
  id?: string;
  teacherId: string;
  academicYear: string;
  department: string;
  class: string;
  division: string;
  batchName: string;
  rbtFrom: string;
  rbtTo: string;
  status?: 'Pending' | 'Approved' | 'Rejected';
  rejectionReason?: string;
  updatedAt?: string;
  teacherName?: string; // For Admin UI
}

export interface AttendanceSession {
  id: string;
  teacherId: string;
  date: string;
  academicYear: string;
  department: string;
  class: string;
  division: string;
  batchName: string;
  locked: boolean;
  createdAt: string;
  rbtFrom?: string;
  rbtTo?: string;
}

export interface AttendanceRecord {
  id?: string;
  sessionId: string;
  studentPrn: string;
  status: 'Present' | 'Absent' | 'Late';
  remark?: string;
  approvedByGfm?: string;
  createdAt?: string;
}

export const getTeacherBatchConfig = async (teacherId: string): Promise<TeacherBatchConfig | null> => {
  const { data, error } = await supabase
    .from('teacher_batch_configs')
    .select('*')
    .eq('teacher_id', teacherId)
    .maybeSingle();

  if (error || !data) return null;
  return toCamelCase(data) as TeacherBatchConfig;
};

export const saveTeacherBatchConfig = async (config: TeacherBatchConfig) => {
  const snakeData = toSnakeCase(config);

  // Ensure id is not sent for teacher_id-based upsert to avoid primary key conflicts
  delete snakeData.id;
  delete snakeData.created_at;
  delete snakeData.updated_at;
  delete snakeData.teacher_name; // Computed field

  const { data, error } = await supabase
    .from('teacher_batch_configs')
    .upsert(snakeData, { onConflict: 'teacher_id' });


  if (error) {
    console.error('Error saving batch config:', JSON.stringify(error, null, 2));
    throw new Error(error.message || 'Failed to save batch config');
  }
};

export const getAllBatchConfigsInContext = async (dept: string, year: string, div: string) => {
  const { data, error } = await supabase
    .from('teacher_batch_configs')
    .select('*')
    .eq('department', dept)
    .eq('class', year)
    .eq('division', div);

  if (error) throw error;
  return (data || []).map(toCamelCase) as TeacherBatchConfig[];
};

// Removed getAllPendingBatchConfigs and updateBatchConfigStatus as batch approval is no longer required.

export const createAttendanceSession = async (session: Partial<AttendanceSession>) => {
  const snakeData = toSnakeCase(session);

  // Try to find existing session first to avoid 409
  const { data: existing } = await supabase
    .from('attendance_sessions')
    .select('id')
    .eq('date', snakeData.date)
    .eq('division', snakeData.division)
    .eq('batch_name', snakeData.batch_name)
    .eq('class', snakeData.class)
    .eq('department', snakeData.department)
    .maybeSingle();

  if (existing) {
    // Delete existing records for this session to overwrite
    await supabase.from('attendance_records').delete().eq('session_id', existing.id);

    // Update session metadata
    const { data, error } = await supabase
      .from('attendance_sessions')
      .update(snakeData)
      .eq('id', existing.id)
      .select()
      .single();

    if (error) throw error;
    return toCamelCase(data) as AttendanceSession;
  }

  const { data, error } = await supabase
    .from('attendance_sessions')
    .insert(snakeData)
    .select()
    .single();

  if (error) throw error;
  return toCamelCase(data) as AttendanceSession;
};

export const saveAttendanceRecords = async (records: AttendanceRecord[]) => {
  const snakeRecords = records.map(r => toSnakeCase(r));
  const { error } = await supabase
    .from('attendance_records')
    .insert(snakeRecords);

  if (error) throw error;
};

export const deleteAttendanceSession = async (sessionId: string) => {
  // First delete all records for this session
  const { error: recordsError } = await supabase
    .from('attendance_records')
    .delete()
    .eq('session_id', sessionId);

  if (recordsError) throw recordsError;

  // Then delete the session itself
  const { error: sessionError } = await supabase
    .from('attendance_sessions')
    .delete()
    .eq('id', sessionId);

  if (sessionError) throw sessionError;
};

export const getAttendanceRecords = async (sessionId: string) => {
  const { data, error } = await supabase
    .from('attendance_records')
    .select(`
        *,
        students!student_prn(
    full_name,
          phone,
          roll_no
        )
      `)
    .eq('session_id', sessionId);

  if (error) {
    console.error('Error fetching attendance records:', error);
    return [];
  }
  return data.map(item => ({
    ...toCamelCase(item),
    fullName: (item as any).students?.full_name,
    phone: (item as any).students?.phone,
    rollNo: (item as any).students?.roll_no
  }));
};

export const getTodayAttendanceSession = async (teacherId: string, batchName: string, division: string): Promise<AttendanceSession | null> => {
  const today = new Date().toISOString().split('T')[0];
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select('*')
    .eq('teacher_id', teacherId)
    .eq('date', today)
    .eq('batch_name', batchName)
    .eq('division', division)
    .maybeSingle();

  if (error || !data) return null;
  return toCamelCase(data) as AttendanceSession;
};

export const getStudentsByRbtRange = async (dept: string, year: string, div: string, from: string, to: string): Promise<Student[]> => {
  // Use cache-first strategy
  const cacheKey = `students_${dept}_${year}_${div}_${from}_${to} `;
  const db = await dbPromise;

  if (db) {
    try {
      const cached = await db.getFirstAsync(
        'SELECT data, updatedAt FROM attendance_cache WHERE key = ?',
        [cacheKey]
      ) as { data: string, updatedAt: number } | null;
      if (cached && (Date.now() - cached.updatedAt < 24 * 60 * 60 * 1000)) {
        return JSON.parse(cached.data);
      }
    } catch (e) { console.warn('Cache read failed:', e); }
  }

  // Fetch from Supabase
  // We'll fetch all students for the div and filter locally by PRN range for accuracy
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('branch', dept)
    .eq('year_of_study', year)
    .eq('division', div)
    .order('prn', { ascending: true });

  if (error) throw error;

  // Sorting: Last 3 digits of PRN sequence (numeric)
  const sortedData = data.sort((a, b) => {
    const aSeq = parseInt(a.prn.slice(-3)) || 0;
    const bSeq = parseInt(b.prn.slice(-3)) || 0;
    return aSeq - bSeq;
  });

  let students = sortedData.map(toCamelCase) as Student[];

  // Filter by rollNo range
  students = students.filter(s => {
    const fromVal = from.toUpperCase();
    const toVal = to.toUpperCase();

    // Helper to extract numeric part from end (works with RBT24CS101 or just 101)
    const extractNum = (str: string) => {
      const match = str.match(/\d+$/);
      return match ? parseInt(match[0]) : NaN;
    };

    const fromNum = extractNum(fromVal);
    const toNum = extractNum(toVal);
    const studentRollNum = extractNum(s.rollNo || s.prn);

    if (!isNaN(fromNum) && !isNaN(toNum) && !isNaN(studentRollNum)) {
      // For Roll Numbers like CS2415, we only want the sequence part (last 2 or 3 digits)
      // but if the user enters "15", we should compare correctly.
      // If studentRollNum is 2415 and fromNum is 15, we need to decide.
      // Usually the user enters the sequence part.
      // For Roll Numbers like CS2415, we want the sequence part.
      // Since roll_no is CS[YY][XX], extractNum gives YY[XX].
      // We assume the first 2 digits of the numeric part are the year.
      const sStr = studentRollNum.toString();
      const studentSeq = sStr.length > 2 ? parseInt(sStr.slice(2)) : studentRollNum;

      const fStr = fromNum.toString();
      const fromSeq = fStr.length > 2 ? parseInt(fStr.slice(2)) : fromNum;

      const tStr = toNum.toString();
      const toSeq = tStr.length > 2 ? parseInt(tStr.slice(2)) : toNum;

      return studentSeq >= fromSeq && studentSeq <= toSeq;
    }

    // Fallback to PRN string comparison if numeric extraction fails
    const prnVal = s.prn.toUpperCase();
    return prnVal >= fromVal && prnVal <= toVal;
  });

  // Update Cache
  if (db) {
    try {
      await db.runAsync(
        'INSERT OR REPLACE INTO attendance_cache (key, data, updatedAt) VALUES (?, ?, ?)',
        [cacheKey, JSON.stringify(students), Date.now()]
      );
    } catch (e) { console.warn('Cache write failed:', e); }
  }

  return students;
};

export const getStudentsByDivision = async (dept: string, year: string, div: string, bypassCache = false): Promise<Student[]> => {
  // Use cache-first strategy unless bypassCache is true
  const cacheKey = `students_div_${dept}_${year}_${div} `;
  const db = await dbPromise;

  if (db && !bypassCache) {
    try {
      const cached = await db.getFirstAsync(
        'SELECT data, updatedAt FROM attendance_cache WHERE key = ?',
        [cacheKey]
      ) as { data: string, updatedAt: number } | null;
      if (cached && (Date.now() - cached.updatedAt < 24 * 60 * 60 * 1000)) {
        return JSON.parse(cached.data);
      }
    } catch (e) { console.warn('Cache read failed:', e); }
  }

  // Fetch from Supabase
  const { data, error } = await supabase
    .from('students')
    .select('*')
    .eq('branch', dept)
    .eq('year_of_study', year)
    .eq('division', div);

  if (error) throw error;

  // Sorting: Last 3 digits of PRN sequence (numeric)
  const sortedData = data.sort((a, b) => {
    const aSeq = parseInt(a.prn.slice(-3)) || 0;
    const bSeq = parseInt(b.prn.slice(-3)) || 0;
    return aSeq - bSeq;
  });

  const students = sortedData.map(toCamelCase) as Student[];

  // Update Cache
  if (db) {
    try {
      await db.runAsync(
        'INSERT OR REPLACE INTO attendance_cache (key, data, updatedAt) VALUES (?, ?, ?)',
        [cacheKey, JSON.stringify(students), Date.now()]
      );
    } catch (e) { console.warn('Cache write failed:', e); }
  }

  return students;
};

export const updateAttendanceRecord = async (recordId: string, status: string, remark: string, approvedByGfm?: string) => {
  const { error } = await supabase
    .from('attendance_records')
    .update({ status, remark, approved_by_gfm: approvedByGfm, updated_at: new Date().toISOString() })
    .eq('id', recordId);

  if (error) throw error;
};

export const getGfmAttendanceSummary = async (dept: string, year: string, div: string, date: string) => {
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select(`
        *,
        attendance_records(
          status,
          student_prn,
          remark,
          approved_by_gfm,
          students(
            full_name,
            phone
          )
        )
          `)
    .eq('department', dept)
    .eq('academic_year', year)
    .eq('division', div)
    .eq('date', date);

  if (error) return [];
  return data.map(toCamelCase);
};
export const getTodayAttendanceSummary = async (date: string) => {
  // 1. Fetch sessions for the specific date
  const { data: sessions, error: sessionError } = await supabase
    .from('attendance_sessions')
    .select(`
        *,
        profiles: teacher_id(full_name)
          `)
    .eq('date', date);

  if (sessionError) throw sessionError;

  // 2. Fetch all batch configs to know what is "expected"
  const { data: batchConfigs, error: batchError } = await supabase
    .from('teacher_batch_configs')
    .select(`
          *,
          profiles: teacher_id(full_name)
            `);

  if (batchError) throw batchError;

  // 3. Fetch all absentee records for these sessions
  const sessionIds = sessions.map(s => s.id);
  let absentRecords: any[] = [];

  if (sessionIds.length > 0) {
    const { data: absents, error: absentError } = await supabase
      .from('attendance_records')
      .select('id, student_prn, session_id')
      .eq('status', 'Absent')
      .in('session_id', sessionIds);

    if (absentError) throw absentError;
    absentRecords = absents;
  }

  return {
    sessions: sessions.map(s => ({
      ...toCamelCase(s),
      teacherName: (s as any).profiles?.full_name
    })),
    batchConfigs: batchConfigs.map(b => ({
      ...toCamelCase(b),
      teacherName: (b as any).profiles?.full_name
    })),
    absentRecords: absentRecords.map(toCamelCase)
  };
};

export const getAdminAnalytics = async () => {
  // 1. Fetch sessions
  const { data: sessions, error: sessionError } = await supabase
    .from('attendance_sessions')
    .select(`
            *,
            profiles: teacher_id(full_name)
              `)
    .order('created_at', { ascending: false });

  if (sessionError) throw sessionError;

  // 2. Fetch all batch configs
  const { data: batchConfigs, error: batchError } = await supabase
    .from('teacher_batch_configs')
    .select(`
              *,
              profiles: teacher_id(full_name)
                `);

  if (batchError) throw batchError;

  // 3. Fetch absent records
  const { data: absents, error: absentError } = await supabase
    .from('attendance_records')
    .select('id, student_prn, session_id, created_at')
    .eq('status', 'Absent');

  if (absentError) throw absentError;

  // 4. Fetch communication logs (calls)
  const { data: calls, error: callError } = await supabase
    .from('communication_logs')
    .select(`
                *,
                profiles: gfm_id(full_name)
                  `)
    .order('created_at', { ascending: false });

  if (callError) throw callError;

  // 5. Fetch all students (for names)
  const { data: studentsRecords, error: studentError } = await supabase
    .from('students')
    .select('prn, full_name, roll_no');

  if (studentError) console.warn('Student names fetch error:', studentError);

  const sortedStudents = (studentsRecords || []).sort((a: any, b: any) => {
    const aSeq = parseInt(a.prn.slice(-3)) || 0;
    const bSeq = parseInt(b.prn.slice(-3)) || 0;
    return aSeq - bSeq;
  });

  // 6. Fetch pre-informed absences (leave notes)
  const { data: leaveNotes, error: leaveError } = await supabase
    .from('pre_informed_absences')
    .select('*');

  if (leaveError) console.warn('Leave notes fetch error:', leaveError);

  return {
    sessions: sessions.map(s => ({
      ...toCamelCase(s),
      teacherName: (s as any).profiles?.full_name
    })),
    batchConfigs: batchConfigs.map(b => ({
      ...toCamelCase(b),
      teacherName: (b as any).profiles?.full_name
    })),
    absentRecords: absents.map(toCamelCase),
    calls: calls.map(c => ({
      ...toCamelCase(c),
      teacherName: (c as any).profiles?.full_name
    })),
    students: sortedStudents,
    leaveNotes: (leaveNotes || []).map(toCamelCase)
  };
};

export const updateLocalVerificationStatus = async (table: string, idOrPrn: string, status: string, verifiedBy: string) => {
  const db = await dbPromise;
  if (!db) return;

  const idField = table === 'students' ? 'prn' : 'id';
  if (table === 'students') {
    await db.runAsync(
      'UPDATE students SET verificationStatus = ?, verifiedBy = ?, lastUpdated = ? WHERE prn = ?',
      [status, verifiedBy, new Date().toISOString(), idOrPrn]
    );
  }
};
