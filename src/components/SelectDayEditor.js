'use client';

import { useState, useEffect } from 'react';
import { FaCalendarAlt, FaCheck } from 'react-icons/fa';

/**
 * مكون لاختيار وتحرير أيام الأسبوع
 * 
 * @param {Object} props خصائص المكون
 * @param {Array<string>} props.selectedDays الأيام المختارة مسبقًا
 * @param {Function} props.onChange دالة تُستدعى عند تغيير الأيام المختارة
 * @param {boolean} props.disabled تعطيل المكون
 * @returns {JSX.Element}
 */
export default function SelectDayEditor({ selectedDays = [], onChange, disabled = false }) {
  // قائمة أيام الأسبوع بالعربية والإنجليزية
  const daysOfWeek = [
    { id: 'monday', arName: 'الإثنين', enName: 'Monday' },
    { id: 'tuesday', arName: 'الثلاثاء', enName: 'Tuesday' },
    { id: 'wednesday', arName: 'الأربعاء', enName: 'Wednesday' },
    { id: 'thursday', arName: 'الخميس', enName: 'Thursday' },
    { id: 'friday', arName: 'الجمعة', enName: 'Friday' },
    { id: 'saturday', arName: 'السبت', enName: 'Saturday' },
    { id: 'sunday', arName: 'الأحد', enName: 'Sunday' }
  ];
  
  // حالة تخزين الأيام المحددة
  const [selected, setSelected] = useState(selectedDays || []);
  
  // تحديث الأيام المحددة عند تغيير الخاصية
  useEffect(() => {
    setSelected(selectedDays || []);
  }, [selectedDays]);
  
  // تبديل حالة يوم (إضافة/إزالة)
  const toggleDay = (dayId) => {
    if (disabled) return;
    
    const updatedDays = selected.includes(dayId)
      ? selected.filter(id => id !== dayId)
      : [...selected, dayId];
    
    setSelected(updatedDays);
    
    // استدعاء دالة التغيير إذا وُجدت
    if (onChange) {
      onChange(updatedDays);
    }
  };
  
  return (
    <div className="w-full">
      <div className="flex items-center mb-2 text-gray-700 dark:text-gray-300">
        <FaCalendarAlt className="mr-2" />
        <span className="font-medium">أيام النشر</span>
      </div>
      
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-7 gap-2">
        {daysOfWeek.map((day) => (
          <button
            key={day.id}
            type="button"
            onClick={() => toggleDay(day.id)}
            disabled={disabled}
            className={`
              relative flex flex-col items-center justify-center p-2 rounded-md transition-colors
              ${selected.includes(day.id)
                ? 'bg-blue-100 border-blue-500 text-blue-800 dark:bg-blue-900 dark:text-blue-300'
                : 'bg-gray-100 border-gray-300 text-gray-700 dark:bg-gray-700 dark:text-gray-300'
              }
              ${disabled ? 'opacity-60 cursor-not-allowed' : 'hover:bg-blue-50 dark:hover:bg-blue-800 cursor-pointer'}
              border
            `}
          >
            {selected.includes(day.id) && (
              <div className="absolute top-1 right-1 text-blue-600 dark:text-blue-400">
                <FaCheck size={12} />
              </div>
            )}
            <span className="text-xs md:text-sm font-bold">{day.arName}</span>
            <span className="text-xs text-gray-500 dark:text-gray-400">{day.enName}</span>
          </button>
        ))}
      </div>
      
      <div className="mt-2 text-xs text-right text-gray-500 dark:text-gray-400">
        {selected.length === 0 ? (
          <span>لم يتم اختيار أيام للنشر</span>
        ) : (
          <span>تم اختيار {selected.length} {selected.length === 1 ? 'يوم' : 'أيام'} للنشر</span>
        )}
      </div>
    </div>
  );
} 