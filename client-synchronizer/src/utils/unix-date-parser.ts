/*
* According to UNIX ls -l standard, for files more recent than 6 months 
* the last modified timestamp will be shown in the format MM DD HH:MM, without the year.
* So when the timestamp contains ":", check these 2 things:
* - if the month and day are greater than the current date, use the previous year
* - if they are equal or lower, use the current year
*/
export default function parseUNIXLsDate(unixDate:string): Date{
    if (!unixDate.includes(':')){
        return new Date(unixDate);
    }else{
        //Get today's date
        const currDateObj = new Date();
        const currTimestamp = currDateObj.toISOString()
        const currDate= currTimestamp.split("T")[0]
        const currYear= parseInt(currDate.split("-")[0])
        const currMonth= parseInt(currDate.split("-")[1])
        const currDay= parseInt(currDate.split("-")[2])
        //console.log(`${currYear} ${currMonth} ${currDay}`)
        //Convert unix date to date obj (useful to compare months as integers)
        const dateObj = new Date(unixDate);
        const dateTimestamp = dateObj.toISOString()
        const date= dateTimestamp.split("T")[0]
        const year= parseInt(date.split("-")[0])
        const month= parseInt(date.split("-")[1])
        const day= parseInt(date.split("-")[2])
        //console.log(`${year} ${month} ${day}`)

        let parsedYear=currYear;
        //Compare
        if(month==currMonth){
            //Compare days
            //!In theory we should also compare hours, but since dates can be at most 6 months apart it SHOULD not be a problem
            if(day>currDay){
                parsedYear--
            }
        }else{
            //Compare months
            if(month>currMonth){
                parsedYear--
            }
        }


        let arr = unixDate.split(' ');
        const parsedDateString = `${arr[0]} ${arr[1]} ${parsedYear} ${arr[2]}:00.000Z`; //!added .000Z to specify UTC timestamp
        return new Date(parsedDateString)
    }
}