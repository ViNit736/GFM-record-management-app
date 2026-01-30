import React from 'react';
import { ActivityIndicator, Text } from 'react-native';
import { COLORS } from '../../constants/colors';
import { AcademicManagement } from './AcademicManagement';
import { AchievementsManagement } from './AchievementsManagement';
import { ActivitiesManagement } from './ActivitiesManagement';
import { AdminReportsManagement } from './AdminReportsManagement';
import { AnalyticsManagement } from './AnalyticsManagement';
import { AttendanceManagement } from './AttendanceManagement';
import { AttendanceSummaryManagement } from './AttendanceSummaryManagement';
import { BatchInfoManagement } from './BatchInfoManagement';
import { CoursesManagement } from './CoursesManagement';
import { DailyAttendanceTracking } from './DailyAttendanceTracking';
import { FeeManagement } from './FeeManagement';
import { InternshipsManagement } from './InternshipsManagement';
import { RegistrationModule } from './RegistrationModule';
import { StaffManagement } from './StaffManagement';
import { StudentManagement } from './StudentManagement';

export const ModuleRenderer = ({
    currentModule,
    teacherPrn,
    teacherDept,
    students,
    searchQuery,
    gfmFilters,
    attFilters,
    courses,
    semFilter,
    activityTypeFilter,
    onViewStudentDetails,
    onViewAcademicRecord,
    onPrintStudent,
    onQuickEdit,
    onRefresh,
    onViewDocument,
    yearsOfStudy,
    batchConfig,
    router
}: any) => {
    const filters = currentModule === 'analytics' || currentModule === 'attendance' || currentModule === 'attendance-summary' || currentModule === 'admin-reports' || currentModule === 'manage-staff' ? attFilters : gfmFilters;

    if (!filters) return <ActivityIndicator size="small" color={COLORS.primary} />;

    switch (currentModule) {
        case 'analytics':
            return <AnalyticsManagement students={students} filters={filters} />;
        case 'students':
            return (
                <StudentManagement
                    students={students}
                    filters={filters}
                    searchQuery={searchQuery}
                    onViewDetails={onViewStudentDetails}
                    onPrint={onPrintStudent}
                    onQuickEdit={onQuickEdit}
                />
            );
        case 'courses':
            return <CoursesManagement courses={courses} filters={filters} loadData={onRefresh} />;
        case 'academic':
            return (
                <AcademicManagement
                    students={students}
                    filters={filters}
                    searchQuery={searchQuery}
                    onViewDetails={onViewStudentDetails}
                    onViewAcademicDetails={onViewAcademicRecord}
                />
            );
        case 'fees':
            return <FeeManagement students={students} filters={filters} loadData={onRefresh} />;
        case 'activities':
            return <ActivitiesManagement students={students} filters={filters} handleViewDocument={onViewDocument} />;
        case 'achievements':
            return <AchievementsManagement students={students} filters={filters} handleViewDocument={onViewDocument} />;
        case 'internships':
            return <InternshipsManagement students={students} filters={filters} handleViewDocument={onViewDocument} />;
        case 'attendance-summary':
            return <AttendanceSummaryManagement students={students} filters={filters} />;
        case 'attendance':
            return <AttendanceManagement students={students} filters={filters} loadData={onRefresh} batchConfig={batchConfig} />;
        case 'admin-reports':
            return <AdminReportsManagement filters={filters} />;
        case 'manage-staff':
            return <StaffManagement />;
        case 'daily-attendance':
            return <DailyAttendanceTracking />;
        case 'register-student':
            return <RegistrationModule />;
        case 'batch-info':
            return <BatchInfoManagement batchConfig={batchConfig} />;
        default:
            return <Text>Select a module from sidebar</Text>;
    }
};
