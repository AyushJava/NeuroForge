package com.neuroforge.backend.validation;

import jakarta.validation.ConstraintValidator;
import jakarta.validation.ConstraintValidatorContext;
import java.lang.reflect.Field;
import java.time.LocalDateTime;

public class NotSameDayValidator implements ConstraintValidator<NotSameDay, Object> {

    private String startDateField;
    private String endDateField;

    @Override
    public void initialize(NotSameDay constraintAnnotation) {
        this.startDateField = constraintAnnotation.startDateField();
        this.endDateField = constraintAnnotation.endDateField();
    }

    @Override
    public boolean isValid(Object value, ConstraintValidatorContext context) {
        if (value == null) {
            return true;
        }

        try {
            Field startDateFieldObj = value.getClass().getDeclaredField(startDateField);
            Field endDateFieldObj = value.getClass().getDeclaredField(endDateField);
            
            startDateFieldObj.setAccessible(true);
            endDateFieldObj.setAccessible(true);
            
            LocalDateTime startDate = (LocalDateTime) startDateFieldObj.get(value);
            LocalDateTime endDate = (LocalDateTime) endDateFieldObj.get(value);
            
            // If either date is null, validation passes (let other validators handle null checks)
            if (startDate == null || endDate == null) {
                return true;
            }
            
            // Check if dates are on the same day
            return !startDate.toLocalDate().isEqual(endDate.toLocalDate());
            
        } catch (NoSuchFieldException | IllegalAccessException e) {
            return true; // If fields don't exist, skip validation
        }
    }
}
