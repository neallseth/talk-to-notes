-- Main script
on run argv
    set exportDir to item 1 of argv
    do shell script "echo Export directory: " & quoted form of POSIX path of exportDir
    
    set endDate to (current date)
    set startDate to (current date) - 30 * days
    set jsonOutput to "["
    set eventCount to 0
    set totalEvents to 0

    tell application "Calendar"
        set allEvents to {}
        repeat with theCalendar in calendars
            set theEvents to (every event of theCalendar whose start date is greater than or equal to startDate and start date is less than or equal to endDate)
            set allEvents to allEvents & theEvents
        end repeat
        set totalEvents to count of allEvents
    end tell

    repeat with theEvent in allEvents
        try
            tell application "Calendar"
                set eventName to summary of theEvent as string
                set eventDate to start date of theEvent as string
            end tell
            
            -- Append event JSON to output
            set jsonOutput to jsonOutput & "{"
            set jsonOutput to jsonOutput & "\"name\": \"" & eventName & "\","
            set jsonOutput to jsonOutput & "\"date\": \"" & eventDate & "\""
            set jsonOutput to jsonOutput & "}"
            
            set eventCount to eventCount + 1
            
            -- Add a comma if this is not the last event
            if eventCount is not equal to totalEvents then
                set jsonOutput to jsonOutput & ","
            end if
            
        on error errMsg number errNum
            do shell script "echo Skipped event due to error: " & errMsg
        end try
    end repeat

    set jsonOutput to jsonOutput & "]"

    -- Write the JSON output to a file
    set filePath to POSIX path of exportDir & "/CalendarEvents.json"
    do shell script "echo File path: " & quoted form of filePath
    try
        set fileRef to open for access file (POSIX file filePath as text) with write permission
        set eof of fileRef to 0
        write jsonOutput to fileRef as «class utf8»
        close access fileRef
        do shell script "echo Finished writing JSON to " & quoted form of filePath
    on error errMsg number errNum
        do shell script "echo Error writing to file: " & quoted form of errMsg & " (" & errNum & ")"
        try
            close access file filePath
        end try
    end try
end run