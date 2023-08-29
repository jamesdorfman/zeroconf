export const date_to_unix_timestamp = (date_string) => {
    return Math.floor( Date.parse(date_string) / 1000 );
}

export const unix_timestamp_to_date = (timestamp) => {
    console.log("Converting " + timestamp)
    let options = {
        year: "numeric",
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    };
    let ret = new Date(timestamp * 1000).toLocaleDateString("en-US", options); // TODO
    return ret;
}

export const sat_to_btc = (sat) => {
    return (sat / 100000000).toFixed(8)
}