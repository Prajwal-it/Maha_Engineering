# Maha Engineering Cutoff API

Start the server with `npm run dev`, then use these GET endpoints:

| API | Example |
| --- | --- |
| All cutoffs | `/cutoffs` |
| One cutoff document | `/cutoffs/:id` |
| Course | `/cutoffs/course/Computer%20Engineering` |
| College code | `/cutoffs/college/6271` |
| Academic year | `/cutoffs/year/2024-25` |
| CAP round | `/cutoffs/round/I` |
| Seat category | `/cutoffs/category/AI` |
| Exam | `/cutoffs/exam/JEE` |
| Seat type | `/cutoffs/seat-type/GOPENH` |
| One college with filters | `/cutoffs/college/6271/filter?year=2024-25&round=I` |
| All colleges with filters | `/cutoffs/filters?year=2024-25&course=Computer%20Engineering` |

For example: `http://localhost:3000/cutoffs/year/2024-25`.

The filter APIs accept `year`, `round`, `category`, `course`, `exam`, and `seatType`. The `/cutoffs/filters` API also accepts `collegeCode`.
