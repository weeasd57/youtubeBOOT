/**
 * مساعد لتنظيف وإعادة تعيين حقل إدخال الملف
 * يتيح للمستخدم تحميل نفس الملف مرة أخرى بعد حذف البيانات
 * @param {React.RefObject} fileInputRef - مرجع لعنصر إدخال الملف
 */
export const resetFileInput = (fileInputRef) => {
  if (fileInputRef && fileInputRef.current) {
    // تنظيف قيمة الإدخال للسماح بإعادة تحميل نفس الملف
    fileInputRef.current.value = '';
  }
};

/**
 * مساعد لفتح مربع حوار اختيار الملف بعد تنظيفه
 * @param {React.RefObject} fileInputRef - مرجع لعنصر إدخال الملف
 */
export const openFileDialog = (fileInputRef) => {
  if (fileInputRef && fileInputRef.current) {
    resetFileInput(fileInputRef);
    fileInputRef.current.click();
  }
}; 