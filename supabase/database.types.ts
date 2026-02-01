export type Json =
    | string
    | number
    | boolean
    | null
    | { [key: string]: Json | undefined }
    | Json[]

export type Database = {
    // Allows to automatically instantiate createClient with right options
    // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
    __InternalSupabase: {
        PostgrestVersion: "14.1"
    }
    public: {
        Tables: {
            academic_records: {
                Row: {
                    academic_year: string | null
                    cgpa: number | null
                    course_def_id: number | null
                    created_at: string | null
                    ese_marks: number | null
                    grade: string | null
                    id: number
                    ise_marks: number | null
                    mse_marks: number | null
                    prn: string | null
                    semester: number | null
                    sgpa: number | null
                    total_marks: number | null
                }
                Insert: {
                    academic_year?: string | null
                    cgpa?: number | null
                    course_def_id?: number | null
                    created_at?: string | null
                    ese_marks?: number | null
                    grade?: string | null
                    id?: never
                    ise_marks?: number | null
                    mse_marks?: number | null
                    prn?: string | null
                    semester?: number | null
                    sgpa?: number | null
                    total_marks?: number | null
                }
                Update: {
                    academic_year?: string | null
                    cgpa?: number | null
                    course_def_id?: number | null
                    created_at?: string | null
                    ese_marks?: number | null
                    grade?: string | null
                    id?: never
                    ise_marks?: number | null
                    mse_marks?: number | null
                    prn?: string | null
                    semester?: number | null
                    sgpa?: number | null
                    total_marks?: number | null
                }
                Relationships: [
                    {
                        foreignKeyName: "academic_records_course_def_id_fkey"
                        columns: ["course_def_id"]
                        isOneToOne: false
                        referencedRelation: "course_definitions"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "academic_records_prn_fkey"
                        columns: ["prn"]
                        isOneToOne: false
                        referencedRelation: "students"
                        referencedColumns: ["prn"]
                    }
                ]
            }
            attendance_records: {
                Row: {
                    approved_at: string | null
                    approved_by_gfm: string | null
                    created_at: string | null
                    id: number
                    session_id: number | null
                    status: string | null
                    student_prn: string | null
                }
                Insert: {
                    approved_at?: string | null
                    approved_by_gfm?: string | null
                    created_at?: string | null
                    id?: never
                    session_id?: number | null
                    status?: string | null
                    student_prn?: string | null
                }
                Update: {
                    approved_at?: string | null
                    approved_by_gfm?: string | null
                    created_at?: string | null
                    id?: never
                    session_id?: number | null
                    status?: string | null
                    student_prn?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "attendance_records_approved_by_gfm_fkey"
                        columns: ["approved_by_gfm"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "attendance_records_session_id_fkey"
                        columns: ["session_id"]
                        isOneToOne: false
                        referencedRelation: "attendance_sessions"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "attendance_records_student_prn_fkey"
                        columns: ["student_prn"]
                        isOneToOne: false
                        referencedRelation: "students"
                        referencedColumns: ["prn"]
                    }
                ]
            }
            attendance_reports: {
                Row: {
                    batch_range: string | null
                    created_at: string | null
                    date: string | null
                    department: string | null
                    division: string | null
                    gfm_id: string | null
                    id: string
                    report_data: Json | null
                    total_absent: number | null
                    total_contacted: number | null
                    total_pre_informed: number | null
                    total_students: number | null
                    year: string | null
                }
                Insert: {
                    batch_range?: string | null
                    created_at?: string | null
                    date?: string | null
                    department?: string | null
                    division?: string | null
                    gfm_id?: string | null
                    id?: string
                    report_data?: Json | null
                    total_absent?: number | null
                    total_contacted?: number | null
                    total_pre_informed?: number | null
                    total_students?: number | null
                    year?: string | null
                }
                Update: {
                    batch_range?: string | null
                    created_at?: string | null
                    date?: string | null
                    department?: string | null
                    division?: string | null
                    gfm_id?: string | null
                    id?: string
                    report_data?: Json | null
                    total_absent?: number | null
                    total_contacted?: number | null
                    total_pre_informed?: number | null
                    total_students?: number | null
                    year?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "attendance_reports_gfm_id_fkey"
                        columns: ["gfm_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    }
                ]
            }
            attendance_sessions: {
                Row: {
                    academic_year: string | null
                    created_at: string | null
                    date: string | null
                    department: string | null
                    division: string | null
                    id: number
                    subject: string | null
                    teacher_id: string | null
                }
                Insert: {
                    academic_year?: string | null
                    created_at?: string | null
                    date?: string | null
                    department?: string | null
                    division?: string | null
                    id?: never
                    subject?: string | null
                    teacher_id?: string | null
                }
                Update: {
                    academic_year?: string | null
                    created_at?: string | null
                    date?: string | null
                    department?: string | null
                    division?: string | null
                    id?: never
                    subject?: string | null
                    teacher_id?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "attendance_sessions_teacher_id_fkey"
                        columns: ["teacher_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    }
                ]
            }
            communication_logs: {
                Row: {
                    academic_year: string | null
                    communication_date: string | null
                    communication_type: string | null
                    created_at: string | null
                    custom_description: string | null
                    division: string | null
                    gfm_id: string | null
                    id: number
                    reason: string | null
                    student_prn: string | null
                }
                Insert: {
                    academic_year?: string | null
                    communication_date?: string | null
                    communication_type?: string | null
                    created_at?: string | null
                    custom_description?: string | null
                    division?: string | null
                    gfm_id?: string | null
                    id?: never
                    reason?: string | null
                    student_prn?: string | null
                }
                Update: {
                    academic_year?: string | null
                    communication_date?: string | null
                    communication_type?: string | null
                    created_at?: string | null
                    custom_description?: string | null
                    division?: string | null
                    gfm_id?: string | null
                    id?: never
                    reason?: string | null
                    student_prn?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "communication_logs_gfm_id_fkey"
                        columns: ["gfm_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    },
                    {
                        foreignKeyName: "communication_logs_student_prn_fkey"
                        columns: ["student_prn"]
                        isOneToOne: false
                        referencedRelation: "students"
                        referencedColumns: ["prn"]
                    }
                ]
            }
            course_definitions: {
                Row: {
                    course_code: string | null
                    course_name: string | null
                    created_at: string | null
                    credits: number | null
                    department: string | null
                    id: number
                    semester: number | null
                    year: string | null
                }
                Insert: {
                    course_code?: string | null
                    course_name?: string | null
                    created_at?: string | null
                    credits?: number | null
                    department?: string | null
                    id?: never
                    semester?: number | null
                    year?: string | null
                }
                Update: {
                    course_code?: string | null
                    course_name?: string | null
                    created_at?: string | null
                    credits?: number | null
                    department?: string | null
                    id?: never
                    semester?: number | null
                    year?: string | null
                }
                Relationships: []
            }
            fee_payments: {
                Row: {
                    academic_year: string | null
                    amount_paid: number | null
                    created_at: string | null
                    id: number
                    installment_number: number | null
                    payment_date: string | null
                    receipt_uri: string | null
                    remaining_balance: number | null
                    student_prn: string | null
                    total_fee: number | null
                    verification_status: string | null
                }
                Insert: {
                    academic_year?: string | null
                    amount_paid?: number | null
                    created_at?: string | null
                    id?: never
                    installment_number?: number | null
                    payment_date?: string | null
                    receipt_uri?: string | null
                    remaining_balance?: number | null
                    student_prn?: string | null
                    total_fee?: number | null
                    verification_status?: string | null
                }
                Update: {
                    academic_year?: string | null
                    amount_paid?: number | null
                    created_at?: string | null
                    id?: never
                    installment_number?: number | null
                    payment_date?: string | null
                    receipt_uri?: string | null
                    remaining_balance?: number | null
                    student_prn?: string | null
                    total_fee?: number | null
                    verification_status?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "fee_payments_student_prn_fkey"
                        columns: ["student_prn"]
                        isOneToOne: false
                        referencedRelation: "students"
                        referencedColumns: ["prn"]
                    }
                ]
            }
            internships: {
                Row: {
                    company_name: string | null
                    completion_status: string | null
                    created_at: string | null
                    description: string | null
                    duration_weeks: number | null
                    end_date: string | null
                    id: number
                    role: string | null
                    start_date: string | null
                    student_prn: string | null
                }
                Insert: {
                    company_name?: string | null
                    completion_status?: string | null
                    created_at?: string | null
                    description?: string | null
                    duration_weeks?: number | null
                    end_date?: string | null
                    id?: never
                    role?: string | null
                    start_date?: string | null
                    student_prn?: string | null
                }
                Update: {
                    company_name?: string | null
                    completion_status?: string | null
                    created_at?: string | null
                    description?: string | null
                    duration_weeks?: number | null
                    end_date?: string | null
                    id?: never
                    role?: string | null
                    start_date?: string | null
                    student_prn?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "internships_student_prn_fkey"
                        columns: ["student_prn"]
                        isOneToOne: false
                        referencedRelation: "students"
                        referencedColumns: ["prn"]
                    }
                ]
            }
            pre_informed_absences: {
                Row: {
                    contact_method: string | null
                    created_at: string | null
                    division: string | null
                    end_date: string | null
                    id: number
                    reason: string | null
                    start_date: string | null
                    student_prn: string | null
                    updated_at: string | null
                }
                Insert: {
                    contact_method?: string | null
                    created_at?: string | null
                    division?: string | null
                    end_date?: string | null
                    id?: never
                    reason?: string | null
                    start_date?: string | null
                    student_prn?: string | null
                    updated_at?: string | null
                }
                Update: {
                    contact_method?: string | null
                    created_at?: string | null
                    division?: string | null
                    end_date?: string | null
                    id?: never
                    reason?: string | null
                    start_date?: string | null
                    student_prn?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "pre_informed_absences_student_prn_fkey"
                        columns: ["student_prn"]
                        isOneToOne: false
                        referencedRelation: "students"
                        referencedColumns: ["prn"]
                    }
                ]
            }
            profiles: {
                Row: {
                    created_at: string | null
                    department: string | null
                    email: string | null
                    first_login: boolean | null
                    full_name: string | null
                    id: string
                    password: string | null
                    prn: string | null
                    role: string | null
                    updated_at: string | null
                }
                Insert: {
                    created_at?: string | null
                    department?: string | null
                    email?: string | null
                    first_login?: boolean | null
                    full_name?: string | null
                    id: string
                    password?: string | null
                    prn?: string | null
                    role?: string | null
                    updated_at?: string | null
                }
                Update: {
                    created_at?: string | null
                    department?: string | null
                    email?: string | null
                    first_login?: boolean | null
                    full_name?: string | null
                    id?: string
                    password?: string | null
                    prn?: string | null
                    role?: string | null
                    updated_at?: string | null
                }
                Relationships: []
            }
            students: {
                Row: {
                    aadhar: string | null
                    admission_type: string | null
                    annual_income: string | null
                    branch: string | null
                    caste: string | null
                    category: string | null
                    diploma_board: string | null
                    diploma_branch: string | null
                    diploma_cgpa: string | null
                    diploma_city: string | null
                    diploma_college: string | null
                    diploma_marks: string | null
                    diploma_max_marks: string | null
                    diploma_passing_month: string | null
                    diploma_percentage: string | null
                    diploma_state: string | null
                    diploma_year: string | null
                    division: string | null
                    dob: string | null
                    email: string | null
                    father_name: string | null
                    father_occupation: string | null
                    father_phone: string | null
                    full_name: string | null
                    gender: string | null
                    gfm_id: string | null
                    gfm_name: string | null
                    hsc_board: string | null
                    hsc_city: string | null
                    hsc_college: string | null
                    hsc_marks: string | null
                    hsc_max_marks: string | null
                    hsc_passing_month: string | null
                    hsc_percentage: string | null
                    hsc_state: string | null
                    hsc_year: string | null
                    jee_percentile: string | null
                    last_updated: string | null
                    mht_cet_percentile: string | null
                    mother_name: string | null
                    mother_occupation: string | null
                    permanent_address: string | null
                    phone: string | null
                    photo_uri: string | null
                    pincode: string | null
                    prn: string
                    religion: string | null
                    roll_no: string | null
                    ssc_board: string | null
                    ssc_city: string | null
                    ssc_college: string | null
                    ssc_marks: string | null
                    ssc_max_marks: string | null
                    ssc_passing_month: string | null
                    ssc_percentage: string | null
                    ssc_state: string | null
                    ssc_year: string | null
                    temporary_address: string | null
                    verification_status: string | null
                    verified_by: string | null
                    year_of_study: string | null
                }
                Insert: {
                    aadhar?: string | null
                    admission_type?: string | null
                    annual_income?: string | null
                    branch?: string | null
                    caste?: string | null
                    category?: string | null
                    diploma_board?: string | null
                    diploma_branch?: string | null
                    diploma_cgpa?: string | null
                    diploma_city?: string | null
                    diploma_college?: string | null
                    diploma_marks?: string | null
                    diploma_max_marks?: string | null
                    diploma_passing_month?: string | null
                    diploma_percentage?: string | null
                    diploma_state?: string | null
                    diploma_year?: string | null
                    division?: string | null
                    dob?: string | null
                    email?: string | null
                    father_name?: string | null
                    father_occupation?: string | null
                    father_phone?: string | null
                    full_name?: string | null
                    gender?: string | null
                    gfm_id?: string | null
                    gfm_name?: string | null
                    hsc_board?: string | null
                    hsc_city?: string | null
                    hsc_college?: string | null
                    hsc_marks?: string | null
                    hsc_max_marks?: string | null
                    hsc_passing_month?: string | null
                    hsc_percentage?: string | null
                    hsc_state?: string | null
                    hsc_year?: string | null
                    jee_percentile?: string | null
                    last_updated?: string | null
                    mht_cet_percentile?: string | null
                    mother_name?: string | null
                    mother_occupation?: string | null
                    permanent_address?: string | null
                    phone?: string | null
                    photo_uri?: string | null
                    pincode?: string | null
                    prn: string
                    religion?: string | null
                    roll_no?: string | null
                    ssc_board?: string | null
                    ssc_city?: string | null
                    ssc_college?: string | null
                    ssc_marks?: string | null
                    ssc_max_marks?: string | null
                    ssc_passing_month?: string | null
                    ssc_percentage?: string | null
                    ssc_state?: string | null
                    ssc_year?: string | null
                    temporary_address?: string | null
                    verification_status?: string | null
                    verified_by?: string | null
                    year_of_study?: string | null
                }
                Update: {
                    aadhar?: string | null
                    admission_type?: string | null
                    annual_income?: string | null
                    branch?: string | null
                    caste?: string | null
                    category?: string | null
                    diploma_board?: string | null
                    diploma_branch?: string | null
                    diploma_cgpa?: string | null
                    diploma_city?: string | null
                    diploma_college?: string | null
                    diploma_marks?: string | null
                    diploma_max_marks?: string | null
                    diploma_passing_month?: string | null
                    diploma_percentage?: string | null
                    diploma_state?: string | null
                    diploma_year?: string | null
                    division?: string | null
                    dob?: string | null
                    email?: string | null
                    father_name?: string | null
                    father_occupation?: string | null
                    father_phone?: string | null
                    full_name?: string | null
                    gender?: string | null
                    gfm_id?: string | null
                    gfm_name?: string | null
                    hsc_board?: string | null
                    hsc_city?: string | null
                    hsc_college?: string | null
                    hsc_marks?: string | null
                    hsc_max_marks?: string | null
                    hsc_passing_month?: string | null
                    hsc_percentage?: string | null
                    hsc_state?: string | null
                    hsc_year?: string | null
                    jee_percentile?: string | null
                    last_updated?: string | null
                    mht_cet_percentile?: string | null
                    mother_name?: string | null
                    mother_occupation?: string | null
                    permanent_address?: string | null
                    phone?: string | null
                    photo_uri?: string | null
                    pincode?: string | null
                    prn?: string
                    religion?: string | null
                    roll_no?: string | null
                    ssc_board?: string | null
                    ssc_city?: string | null
                    ssc_college?: string | null
                    ssc_marks?: string | null
                    ssc_max_marks?: string | null
                    ssc_passing_month?: string | null
                    ssc_percentage?: string | null
                    ssc_state?: string | null
                    ssc_year?: string | null
                    temporary_address?: string | null
                    verification_status?: string | null
                    verified_by?: string | null
                    year_of_study?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "students_gfm_id_fkey"
                        columns: ["gfm_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    }
                ]
            }
            teacher_batch_configs: {
                Row: {
                    academic_year: string | null
                    batch_name: string | null
                    class: string | null
                    created_at: string | null
                    department: string | null
                    division: string | null
                    id: number
                    rejection_reason: string | null
                    rbt_from: string | null
                    rbt_to: string | null
                    status: string | null
                    teacher_id: string | null
                    updated_at: string | null
                }
                Insert: {
                    academic_year?: string | null
                    batch_name?: string | null
                    class?: string | null
                    created_at?: string | null
                    department?: string | null
                    division?: string | null
                    id?: never
                    rejection_reason?: string | null
                    rbt_from?: string | null
                    rbt_to?: string | null
                    status?: string | null
                    teacher_id?: string | null
                    updated_at?: string | null
                }
                Update: {
                    academic_year?: string | null
                    batch_name?: string | null
                    class?: string | null
                    created_at?: string | null
                    department?: string | null
                    division?: string | null
                    id?: never
                    rejection_reason?: string | null
                    rbt_from?: string | null
                    rbt_to?: string | null
                    status?: string | null
                    teacher_id?: string | null
                    updated_at?: string | null
                }
                Relationships: [
                    {
                        foreignKeyName: "teacher_batch_configs_teacher_id_fkey"
                        columns: ["teacher_id"]
                        isOneToOne: false
                        referencedRelation: "profiles"
                        referencedColumns: ["id"]
                    }
                ]
            }
        }
        Views: {
            [_ in never]: never
        }
        Functions: {
            [_ in never]: never
        }
        Enums: {
            [_ in never]: never
        }
        CompositeTypes: {
            [_ in never]: never
        }
    }
}

export type Tables<
    PublicTableNameOrOptions extends
    | keyof (Database["public"]["Tables"] & Database["public"]["Views"])
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? (Database[PublicTableNameOrOptions["schema"]]["Tables"] &
        Database[PublicTableNameOrOptions["schema"]]["Views"])[TableName] extends {
            Row: infer R
        }
    ? R
    : never
    : PublicTableNameOrOptions extends keyof (Database["public"]["Tables"] &
        Database["public"]["Views"])
    ? (Database["public"]["Tables"] &
        Database["public"]["Views"])[PublicTableNameOrOptions] extends {
            Row: infer R
        }
    ? R
    : never
    : never

export type TablesInsert<
    PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Insert: infer I
    }
    ? I
    : never
    : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I
    }
    ? I
    : never
    : never

export type TablesUpdate<
    PublicTableNameOrOptions extends
    | keyof Database["public"]["Tables"]
    | { schema: keyof Database },
    TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
    ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
        Update: infer U
    }
    ? U
    : never
    : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U
    }
    ? U
    : never
    : never

export type Enums<
    PublicEnumNameOrOptions extends
    | keyof Database["public"]["Enums"]
    | { schema: keyof Database },
    EnumName extends PublicEnumNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = PublicEnumNameOrOptions extends { schema: keyof Database }
    ? Database[PublicEnumNameOrOptions["schema"]]["Enums"][EnumName]
    : PublicEnumNameOrOptions extends keyof Database["public"]["Enums"]
    ? Database["public"]["Enums"][PublicEnumNameOrOptions]
    : never

export type CompositeTypes<
    PublicCompositeTypeNameOrOptions extends
    | keyof Database["public"]["CompositeTypes"]
    | { schema: keyof Database },
    CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
        schema: keyof Database
    }
    ? keyof Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
    schema: keyof Database
}
    ? Database[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
    : PublicCompositeTypeNameOrOptions extends keyof Database["public"]["CompositeTypes"]
    ? Database["public"]["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never
