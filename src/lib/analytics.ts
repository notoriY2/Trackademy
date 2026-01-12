import { supabase } from './supabase';

export interface PerformanceMetrics {
  totalStudents: number;
  totalEnrollments: number;
  averageGpa: number;
  overallPassRate: number;
  dropoutRate: number;
  examEligibleCount: number;
  examEligibleRate: number;
}

export interface DepartmentPerformance {
  departmentId: string;
  departmentName: string;
  facultyName: string;
  totalStudents: number;
  averageGpa: number;
  passRate: number;
  enrollmentCount: number;
}

export interface CoursePerformance {
  courseId: string;
  code: string;
  name: string;
  semester: string;
  academicYear: string;
  programName: string;
  departmentName: string;
  facultyName: string;
  enrolledStudents: number;
  gradedStudents: number;
  passedStudents: number;
  passRate: number;
  averagePercentage: number;
  averageGpa: number;
}

/**
 * Calculate student GPA from their completed course enrollments
 */
export async function calculateStudentGpa(studentId: string): Promise<number> {
  const { data, error } = await supabase
    .from('student_enrollments')
    .select('grade_points')
    .eq('student_id', studentId)
    .eq('status', 'completed')
    .not('grade_points', 'is', null);

  if (error || !data || data.length === 0) {
    return 0;
  }

  const sum = data.reduce((acc, row) => acc + (row.grade_points || 0), 0);
  const avg = sum / data.length;
  return Math.round(avg * 100) / 100;
}

/**
 * Get system-wide performance metrics
 */
export async function getPerformanceMetrics(): Promise<PerformanceMetrics> {
  try {
    // Total active students
    const { count: totalStudents } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .eq('status', 'active');

    // Total enrollments
    const { count: totalEnrollments } = await supabase
      .from('student_enrollments')
      .select('*', { count: 'exact', head: true })
      .in('status', ['enrolled', 'completed']);

    // Average GPA calculation
    const { data: gpaData } = await supabase
      .from('student_enrollments')
      .select('grade_points')
      .eq('status', 'completed')
      .not('grade_points', 'is', null);

    const averageGpa = gpaData && gpaData.length > 0
      ? Math.round((gpaData.reduce((acc, row) => acc + (row.grade_points || 0), 0) / gpaData.length) * 100) / 100
      : 0;

    // Overall pass rate
    const { data: gradeData } = await supabase
      .from('student_enrollments')
      .select('final_percentage')
      .not('final_percentage', 'is', null);

    const passedCount = gradeData?.filter(row => (row.final_percentage || 0) >= 50).length || 0;
    const overallPassRate = gradeData && gradeData.length > 0
      ? Math.round((passedCount / gradeData.length) * 10000) / 100
      : 0;

    // Dropout rate
    const { count: allStudentsCount } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true });

    const { count: droppedCount } = await supabase
      .from('students')
      .select('*', { count: 'exact', head: true })
      .in('status', ['withdrawn', 'suspended']);

    const dropoutRate = allStudentsCount && allStudentsCount > 0
      ? Math.round(((droppedCount || 0) / allStudentsCount) * 10000) / 100
      : 0;

    // Exam eligible
    const { count: examEligibleCount } = await supabase
      .from('student_enrollments')
      .select('*', { count: 'exact', head: true })
      .eq('is_exam_eligible', true);

    const examEligibleRate = totalEnrollments && totalEnrollments > 0
      ? Math.round(((examEligibleCount || 0) / totalEnrollments) * 10000) / 100
      : 0;

    return {
      totalStudents: totalStudents || 0,
      totalEnrollments: totalEnrollments || 0,
      averageGpa,
      overallPassRate,
      dropoutRate,
      examEligibleCount: examEligibleCount || 0,
      examEligibleRate
    };
  } catch (error) {
    console.error('Error fetching performance metrics:', error);
    return {
      totalStudents: 0,
      totalEnrollments: 0,
      averageGpa: 0,
      overallPassRate: 0,
      dropoutRate: 0,
      examEligibleCount: 0,
      examEligibleRate: 0
    };
  }
}

/**
 * Get department performance metrics
 */
export async function getDepartmentPerformance(): Promise<DepartmentPerformance[]> {
  try {
    const { data: departments, error } = await supabase
      .from('departments')
      .select(`
        id,
        name,
        faculties:faculty_id (
          name
        )
      `)
      .eq('status', 'active');

    if (error || !departments) {
      return [];
    }

    const results: DepartmentPerformance[] = [];

    for (const dept of departments) {
      // Get programs in this department
      const { data: programs } = await supabase
        .from('programs')
        .select('id')
        .eq('department_id', dept.id);

      if (!programs || programs.length === 0) {
        continue;
      }

      const programIds = programs.map(p => p.id);

      // Get students in these programs
      const { data: students, count: studentCount } = await supabase
        .from('students')
        .select('id', { count: 'exact' })
        .in('program_id', programIds)
        .eq('status', 'active');

      if (!students || students.length === 0) {
        results.push({
          departmentId: dept.id,
          departmentName: dept.name,
          facultyName: (dept.faculties as any)?.name || 'Unknown',
          totalStudents: 0,
          averageGpa: 0,
          passRate: 0,
          enrollmentCount: 0
        });
        continue;
      }

      const studentIds = students.map(s => s.id);

      // Get enrollments for these students
      const { data: enrollments, count: enrollmentCount } = await supabase
        .from('student_enrollments')
        .select('grade_points, final_percentage', { count: 'exact' })
        .in('student_id', studentIds);

      // Calculate average GPA
      const gpaValues = enrollments?.filter(e => e.grade_points != null).map(e => e.grade_points) || [];
      const averageGpa = gpaValues.length > 0
        ? Math.round((gpaValues.reduce((acc, val) => acc + val, 0) / gpaValues.length) * 100) / 100
        : 0;

      // Calculate pass rate
      const gradedEnrollments = enrollments?.filter(e => e.final_percentage != null) || [];
      const passedCount = gradedEnrollments.filter(e => e.final_percentage >= 50).length;
      const passRate = gradedEnrollments.length > 0
        ? Math.round((passedCount / gradedEnrollments.length) * 10000) / 100
        : 0;

      results.push({
        departmentId: dept.id,
        departmentName: dept.name,
        facultyName: (dept.faculties as any)?.name || 'Unknown',
        totalStudents: studentCount || 0,
        averageGpa,
        passRate,
        enrollmentCount: enrollmentCount || 0
      });
    }

    return results.sort((a, b) => a.departmentName.localeCompare(b.departmentName));
  } catch (error) {
    console.error('Error fetching department performance:', error);
    return [];
  }
}

/**
 * Get course performance metrics
 */
export async function getCoursePerformance(): Promise<CoursePerformance[]> {
  try {
    const { data: courses, error } = await supabase
      .from('courses')
      .select(`
        id,
        code,
        name,
        semester,
        academic_year,
        programs:program_id (
          name,
          departments:department_id (
            name,
            faculties:faculty_id (
              name
            )
          )
        )
      `)
      .eq('status', 'active')
      .limit(100);

    if (error || !courses) {
      return [];
    }

    const results: CoursePerformance[] = [];

    for (const course of courses) {
      const { data: enrollments, count: enrolledCount } = await supabase
        .from('student_enrollments')
        .select('final_percentage, grade_points', { count: 'exact' })
        .eq('course_id', course.id);

      const gradedEnrollments = enrollments?.filter(e => e.final_percentage != null) || [];
      const passedCount = gradedEnrollments.filter(e => e.final_percentage >= 50).length;
      const passRate = gradedEnrollments.length > 0
        ? Math.round((passedCount / gradedEnrollments.length) * 10000) / 100
        : 0;

      const avgPercentage = gradedEnrollments.length > 0
        ? Math.round((gradedEnrollments.reduce((acc, e) => acc + e.final_percentage, 0) / gradedEnrollments.length) * 100) / 100
        : 0;

      const gpaValues = enrollments?.filter(e => e.grade_points != null).map(e => e.grade_points) || [];
      const avgGpa = gpaValues.length > 0
        ? Math.round((gpaValues.reduce((acc, val) => acc + val, 0) / gpaValues.length) * 100) / 100
        : 0;

      const program = course.programs as any;
      const department = program?.departments as any;
      const faculty = department?.faculties as any;

      results.push({
        courseId: course.id,
        code: course.code,
        name: course.name,
        semester: course.semester,
        academicYear: course.academic_year,
        programName: program?.name || 'Unknown',
        departmentName: department?.name || 'Unknown',
        facultyName: faculty?.name || 'Unknown',
        enrolledStudents: enrolledCount || 0,
        gradedStudents: gradedEnrollments.length,
        passedStudents: passedCount,
        passRate,
        averagePercentage: avgPercentage,
        averageGpa: avgGpa
      });
    }

    return results.sort((a, b) => a.code.localeCompare(b.code));
  } catch (error) {
    console.error('Error fetching course performance:', error);
    return [];
  }
}
