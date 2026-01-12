// TranscriptDisplay.tsx
import React, { useState } from "react";
import {
  GraduationCap,
  Download,
  Calendar,
  User,
  Award,
  BookOpen,
  MapPin,
} from "lucide-react";

interface Course {
  code: string;
  name: string;
  credits: number;
  grade: string;
  points: number;
  semester: string;
  year: string;
}

interface TranscriptData {
  student: {
    name: string;
    studentNumber: string;
    idNumber: string;
    program: string;
    faculty: string;
    department: string;
    yearOfStudy: string;
    registrationDate: string;
  };
  institution: {
    name: string;
    address: string;
    logo?: string;
  };
  academic: {
    courses: Course[];
    totalCredits: number;
    gpa: number;
    cumulativeGPA: number;
    academicStatus: string;
  };
  transcript: {
    issueDate: string;
    registrarName: string;
    registrarSignature?: string;
  };
}

interface TranscriptDisplayProps {
  data: TranscriptData;
  /**
   * Optional override for the download URL. If not provided, defaults to '/api/transcript/pdf'
   * Your server endpoint should return raw PDF bytes with Content-Type: application/pdf
   */
  downloadUrl?: string;
  /**
   * Optional filename for the downloaded PDF
   */
  downloadFilename?: string;
  /**
   * Optional external download handler. If provided, the component will call it instead
   * of performing the built-in fetch. Useful if you already handle the fetch elsewhere.
   */
  onDownload?: () => Promise<void> | void;
}

/**
 * TranscriptDisplay
 *
 * - Layout preserved from the previous design (modern feel)
 * - Implements Option A: fetch PDF bytes from server and save correctly to disk
 *
 * Notes:
 * - Ensure your server endpoint (downloadUrl) returns application/pdf and the raw PDF bytes (not JSON or HTML).
 * - If the server returns an error HTML page, this code will log the response body (first 1k chars) to console to help debugging.
 */
const TranscriptDisplay: React.FC<TranscriptDisplayProps> = ({
  data,
  downloadUrl = "/api/transcript/pdf",
  downloadFilename = "transcript.pdf",
  onDownload,
}) => {
  const [isDownloading, setIsDownloading] = useState(false);

  const calculateSemesterGPA = (semester: string, year: string) => {
    const semesterCourses = data.academic.courses.filter(
      (course) => course.semester === semester && course.year === year
    );
    if (semesterCourses.length === 0) return 0;
    const totalPoints = semesterCourses.reduce((sum, course) => sum + course.points * course.credits, 0);
    const totalCredits = semesterCourses.reduce((sum, course) => sum + course.credits, 0);
    return totalCredits > 0 ? totalPoints / totalCredits : 0;
  };

  const getGradeColor = (grade: string) => {
    switch (grade) {
      case "A+":
      case "A":
        return "text-green-700";
      case "A-":
      case "B+":
        return "text-green-600";
      case "B":
      case "B-":
        return "text-blue-600";
      case "C+":
      case "C":
        return "text-yellow-600";
      case "C-":
      case "D":
        return "text-orange-600";
      case "F":
        return "text-red-600";
      default:
        return "text-gray-700";
    }
  };

  // Group courses by year-semester key
  const groupedCourses = data.academic.courses.reduce((acc, course) => {
    const key = `${course.year}-${course.semester}`;
    if (!acc[key]) acc[key] = [];
    acc[key].push(course);
    return acc;
  }, {} as Record<string, Course[]>);

  // Sort semesters: newest first (year desc, semester desc)
  const sortedSemesters = Object.entries(groupedCourses).sort(([aKey], [bKey]) => {
    const [aYearRaw, aSemRaw] = aKey.split("-");
    const [bYearRaw, bSemRaw] = bKey.split("-");
    const aYear = parseInt(aYearRaw) || 0;
    const bYear = parseInt(bYearRaw) || 0;
    const aSem = parseInt(String(aSemRaw).replace(/\D/g, "")) || (String(aSemRaw).toLowerCase().includes("second") ? 2 : 1);
    const bSem = parseInt(String(bSemRaw).replace(/\D/g, "")) || (String(bSemRaw).toLowerCase().includes("second") ? 2 : 1);
    if (aYear !== bYear) return bYear - aYear;
    return bSem - aSem;
  });

  /**
   * Built-in download handler (Option A)
   * - Fetches the PDF bytes from `downloadUrl`
   * - Validates content-type includes 'pdf'
   * - Creates a blob URL and triggers a download
   */
  const downloadFromServer = async () => {
    setIsDownloading(true);
    try {
      const res = await fetch(downloadUrl, {
        method: "GET",
        // credentials: 'include' // uncomment if you need cookies/auth
      });

      if (!res.ok) {
        // Try to read a bit of the response for debugging (it may be HTML error)
        let debugText = "";
        try {
          debugText = await res.clone().text();
        } catch (e) {
          debugText = "<could not read response body>";
        }
        console.error("Transcript download failed. Status:", res.status, debugText.slice(0, 1000));
        throw new Error(`Server returned ${res.status}`);
      }

      const contentType = res.headers.get("content-type") || "";
      if (!contentType.toLowerCase().includes("pdf")) {
        // Received something other than a PDF (likely an HTML error page). Log a snippet for debugging.
        const text = await res.clone().text();
        console.error("Expected PDF but received:", contentType, text.slice(0, 1000));
        throw new Error("Server did not return a PDF (check console/network for details)");
      }

      const blob = await res.blob();

      // sanity check size
      if (blob.size < 100) {
        console.warn("Downloaded blob is very small ( < 100 bytes ) - may not be a valid PDF.", blob);
      }

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = downloadFilename || "transcript.pdf";
      // Append to DOM to make click work in Firefox
      document.body.appendChild(a);
      a.click();
      a.remove();

      // Give the browser a moment to process the download, then revoke the object URL
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    } catch (err) {
      console.error("Failed to download transcript PDF:", err);
      // Friendly message
      alert(
        "Failed to download PDF. Open the console (F12) and check the Network tab / console for details.\n" +
          "Tips: ensure your server endpoint returns Content-Type: application/pdf and raw PDF bytes."
      );
    } finally {
      setIsDownloading(false);
    }
  };

  // If an external onDownload handler is provided, call it; otherwise use built-in fetch
  const handleDownloadClick = async () => {
    if (onDownload) {
      try {
        setIsDownloading(true);
        await onDownload();
      } catch (err) {
        console.error("External onDownload handler failed:", err);
        alert("Download failed. See console for details.");
      } finally {
        setIsDownloading(false);
      }
    } else {
      await downloadFromServer();
    }
  };

  return (
    <div className="relative max-w-6xl mx-auto">
      <div className="relative bg-white shadow-2xl border border-gray-200 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-900 to-sky-700 text-white p-8 print:bg-white print:text-black">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="bg-white p-3 rounded-full flex items-center justify-center">
                {data.institution.logo ? (
                  // If using a remote logo ensure CORS headers are allowed by the host
                  // or host the image on the same origin.
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={data.institution.logo} alt="logo" className="h-10 w-10 object-contain" />
                ) : (
                  <GraduationCap className="h-8 w-8 text-sky-800" />
                )}
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold tracking-tight">{data.institution.name}</h1>
                <p className="text-sm md:text-base text-sky-100 mt-1">{data.institution.address}</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <div className="text-xs uppercase tracking-wide text-sky-100">Document</div>
                <div className="text-lg md:text-xl font-semibold">Official Academic Transcript</div>
                <div className="text-xs text-sky-100 mt-1">Issued: {data.transcript.issueDate}</div>
              </div>

              <button
                onClick={handleDownloadClick}
                disabled={isDownloading}
                className="inline-flex items-center gap-2 bg-white text-sky-800 px-4 py-2 rounded-lg hover:shadow transition disabled:opacity-60 disabled:cursor-not-allowed"
              >
                <Download className="h-4 w-4" />
                <span className="text-sm font-semibold">{isDownloading ? "Downloading..." : "Download PDF"}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Document Title */}
        <div className="text-center py-6 border-b border-gray-100">
          <h2 className="text-2xl md:text-3xl font-extrabold text-gray-900 mb-1">OFFICIAL ACADEMIC TRANSCRIPT</h2>
          <p className="text-sm md:text-base text-gray-600">
            This certifies the academic record of the student as recorded in the official institutional records.
          </p>
        </div>

        {/* Student Info + Summary badges */}
        <div className="p-8 border-b border-gray-100 grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: student details */}
          <div className="lg:col-span-2 bg-white">
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-14 h-14 rounded-md bg-gray-50 flex items-center justify-center border border-gray-100">
                <User className="h-7 w-7 text-sky-700" />
              </div>
              <div className="w-full">
                <h3 className="text-lg font-semibold text-gray-900">{data.student.name}</h3>
                <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-gray-700">
                  <div>
                    <div className="text-xs text-gray-500">Student Number</div>
                    <div className="font-mono font-semibold">{data.student.studentNumber}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">ID Number</div>
                    <div className="font-mono font-semibold">{data.student.idNumber}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Program</div>
                    <div className="font-semibold">{data.student.program}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Faculty / Department</div>
                    <div className="text-sm">{data.student.faculty} / {data.student.department}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Year of Study</div>
                    <div className="font-semibold">{data.student.yearOfStudy}</div>
                  </div>
                  <div>
                    <div className="text-xs text-gray-500">Registration Date</div>
                    <div className="text-sm">{data.student.registrationDate}</div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right: summary cards */}
          <div className="space-y-3">
            <div className="bg-sky-50 border border-sky-100 rounded-lg p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-sky-600">Total Credits</div>
                <div className="text-xl font-bold text-sky-900">{data.academic.totalCredits}</div>
              </div>
              <div>
                <Award className="h-6 w-6 text-sky-700" />
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-lg p-4 flex items-center justify-between">
              <div>
                <div className="text-xs text-gray-500">GPA</div>
                <div className="text-xl font-bold text-gray-900">{data.academic.gpa.toFixed(2)}</div>
              </div>
              <div>
                <div className="text-xs text-gray-500">Cumulative</div>
                <div className="text-lg font-semibold">{data.academic.cumulativeGPA.toFixed(2)}</div>
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-lg p-3">
              <div className="text-xs text-gray-500">Academic Status</div>
              <div className="text-sm font-semibold text-green-700">{data.academic.academicStatus}</div>
            </div>
          </div>
        </div>

        {/* Academic Record (semesters) */}
        <div className="p-8 space-y-6">
          <h3 className="text-xl font-bold text-gray-900 flex items-center gap-3">
            <BookOpen className="h-5 w-5 text-sky-700" /> Academic Record
          </h3>

          <div className="space-y-6">
            {sortedSemesters.map(([semesterKey, courses]) => {
              const [year, semester] = semesterKey.split("-");
              const semesterGPA = calculateSemesterGPA(semester, year);
              const semesterCredits = courses.reduce((sum, c) => sum + c.credits, 0);

              return (
                <section key={semesterKey} className="border border-gray-100 rounded-lg overflow-hidden bg-white">
                  <div className="bg-gray-50 px-6 py-4 flex items-center justify-between">
                    <div>
                      <div className="text-sm text-gray-500">Semester</div>
                      <div className="text-lg font-semibold text-gray-900">
                        {String(semester).replace(/^0+/, "")} — {year}
                      </div>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-gray-600">
                      <div>
                        <div className="text-xs text-gray-500">Credits</div>
                        <div className="font-semibold text-gray-900">{semesterCredits}</div>
                      </div>
                      <div>
                        <div className="text-xs text-gray-500">GPA</div>
                        <div className="font-semibold text-gray-900">{semesterGPA.toFixed(2)}</div>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[720px]">
                      <thead className="bg-white">
                        <tr className="text-left text-xs text-gray-500 tracking-wide">
                          <th className="px-6 py-3">Course Code</th>
                          <th className="px-6 py-3">Course Name</th>
                          <th className="px-6 py-3 text-center">Credits</th>
                          <th className="px-6 py-3 text-center">Grade</th>
                          <th className="px-6 py-3 text-center">Points</th>
                        </tr>
                      </thead>
                      <tbody>
                        {courses.map((course, idx) => (
                          <tr key={course.code + idx} className={`odd:bg-white even:bg-gray-50 hover:bg-gray-100 transition`}>
                            <td className="px-6 py-4 align-top">
                              <div className="font-mono text-sm text-gray-900">{course.code}</div>
                            </td>
                            <td className="px-6 py-4 align-top">
                              <div className="text-sm text-gray-900 font-medium">{course.name}</div>
                            </td>
                            <td className="px-6 py-4 text-center align-top">
                              <div className="text-sm text-gray-700">{course.credits}</div>
                            </td>
                            <td className="px-6 py-4 text-center align-top">
                              <div className={`text-sm font-bold ${getGradeColor(course.grade)}`}>{course.grade}</div>
                            </td>
                            <td className="px-6 py-4 text-center align-top">
                              <div className="text-sm text-gray-700">{course.points.toFixed(2)}</div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              );
            })}
          </div>

          {/* Academic summary + grading scale cards */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 bg-sky-50 border border-sky-100 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
                <Award className="h-5 w-5 text-sky-700" /> Academic Summary
              </h4>

              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-xs text-gray-500">Total Credits Earned</div>
                  <div className="text-2xl font-bold text-sky-900">{data.academic.totalCredits}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500">Current GPA</div>
                  <div className="text-2xl font-bold text-sky-900">{data.academic.gpa.toFixed(2)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500">Cumulative GPA</div>
                  <div className="text-2xl font-bold text-sky-900">{data.academic.cumulativeGPA.toFixed(2)}</div>
                </div>
                <div className="text-center">
                  <div className="text-xs text-gray-500">Status</div>
                  <div className="text-lg font-semibold text-green-700">{data.academic.academicStatus}</div>
                </div>
              </div>
            </div>

            <div className="bg-white border border-gray-100 rounded-lg p-6">
              <h4 className="text-lg font-semibold text-gray-900 mb-4">Grading Scale</h4>
              <div className="grid grid-cols-2 gap-2 text-sm text-gray-700">
                <div className="flex justify-between"><span className="font-medium">A+ (90-100)</span><span>4.00</span></div>
                <div className="flex justify-between"><span className="font-medium">A (85-89)</span><span>3.75</span></div>
                <div className="flex justify-between"><span className="font-medium">A- (80-84)</span><span>3.50</span></div>
                <div className="flex justify-between"><span className="font-medium">B+ (75-79)</span><span>3.25</span></div>
                <div className="flex justify-between"><span className="font-medium">B (70-74)</span><span>3.00</span></div>
                <div className="flex justify-between"><span className="font-medium">B- (65-69)</span><span>2.75</span></div>
                <div className="flex justify-between"><span className="font-medium">C+ (60-64)</span><span>2.50</span></div>
                <div className="flex justify-between"><span className="font-medium">C (55-59)</span><span>2.25</span></div>
                <div className="flex justify-between"><span className="font-medium">C- (50-54)</span><span>2.00</span></div>
                <div className="flex justify-between"><span className="font-medium">D (40-49)</span><span>1.00</span></div>
                <div className="flex justify-between"><span className="font-medium">F (0-39)</span><span>0.00</span></div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer / Certification / Signature */}
        <div className="p-8 bg-gray-50 border-t border-gray-100">
          <div className="flex flex-col lg:flex-row justify-between gap-6">
            <div>
              <h4 className="text-lg font-semibold text-gray-900 mb-2">Certification</h4>
              <p className="text-sm text-gray-700 max-w-2xl">
                This is to certify that the above is a true and complete record of the academic performance
                of the student named herein, as recorded in the official records of {data.institution.name}.
              </p>

              <div className="flex items-center gap-3 text-sm text-gray-600 mt-4">
                <Calendar className="h-4 w-4" />
                <div>Date of Issue: <span className="font-medium text-gray-900">{data.transcript.issueDate}</span></div>
              </div>
            </div>

            <div className="text-right">
              <div className="mb-2 text-sm text-gray-600">______________________________</div>
              <div className="text-sm font-semibold text-gray-900">{data.transcript.registrarName}</div>
              <div className="text-xs text-gray-500">Registrar</div>
            </div>
          </div>
        </div>

        {/* Security / verification note */}
        <div className="bg-sky-900 text-white p-4 text-center">
          <p className="text-xs">
            This document contains security features to prevent unauthorized reproduction.
            For verification, contact the Registrar's Office at {data.institution.address}.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TranscriptDisplay;
