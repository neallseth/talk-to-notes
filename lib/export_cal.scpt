on run argv
    set exportDir to item 1 of argv
    set exportPath to POSIX path of exportDir & "/CalendarEvents.json"
    do shell script "echo Export directory: " & quoted form of exportPath
    
    set endDate to (current date)
    set startDate to (current date) - 30 * days
    set jsonOutput to "["
    
    tell application "Calendar"
        set allEvents to {}
        repeat with theCalendar in calendars
            set theEvents to (every event of theCalendar whose start date is greater than or equal to startDate and start date is less than or equal to endDate)
            set allEvents to allEvents & theEvents
        end repeat
        set totalEvents to count of allEvents
    end tell

    repeat with i from 1 to totalEvents
        set theEvent to item i of allEvents
        try
            tell application "Calendar"
                set eventName to my escapeJSON(summary of theEvent as string)
                set eventDate to my escapeJSON(start date of theEvent as string)
                set eventDescription to my escapeJSON(description of theEvent as string)
                set eventLocation to my escapeJSON(location of theEvent as string)
            end tell
            
            -- Append event JSON to output
            set jsonOutput to jsonOutput & "{"
            set jsonOutput to jsonOutput & "\"name\": \"" & eventName & "\","
            set jsonOutput to jsonOutput & "\"date\": \"" & eventDate & "\","
            set jsonOutput to jsonOutput & "\"description\": \"" & eventDescription & "\","
            set jsonOutput to jsonOutput & "\"location\": \"" & eventLocation & "\""
            set jsonOutput to jsonOutput & "}"
            
            -- Add a comma if this is not the last event
            if i is not equal to totalEvents then
                set jsonOutput to jsonOutput & ","
            end if
            
        on error errMsg number errNum
            do shell script "echo Skipped event due to error: " & errMsg
        end try
    end repeat

    set jsonOutput to jsonOutput & "]"

    -- Write the JSON output to a file
    try
        set fileRef to open for access (POSIX file exportPath) with write permission
        set eof of fileRef to 0
        write jsonOutput to fileRef as «class utf8»
        close access fileRef
        do shell script "echo Finished writing JSON to " & quoted form of exportPath
    on error errMsg number errNum
        do shell script "echo Error writing to file: " & quoted form of errMsg & " (" & errNum & ")"
        try
            close access file (POSIX file exportPath)
        end try
    end try
end run

-- Function to escape JSON special characters in text
on escapeJSON(theText)
    set theText to replaceText(theText, "\\", "\\\\")
    set theText to replaceText(theText, "\"", "\\\"")
    set theText to replaceText(theText, "/", "\\/")
    set theText to replaceText(theText, "", "\\b")
    set theText to replaceText(theText, "", "\\f")
    set theText to replaceText(theText, "
", "\\n")
    set theText to replaceText(theText, "	", "\\t")
    set theText to replaceText(theText, "", "\\v")
    return theText
end escapeJSON

-- Function to replace text
on replaceText(theText, searchString, replacementString)
    set AppleScript's text item delimiters to searchString
    set theTextItems to every text item of theText
    set AppleScript's text item delimiters to replacementString
    set theText to theTextItems as string
    set AppleScript's text item delimiters to ""
    return theText
end replaceText