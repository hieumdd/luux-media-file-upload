import { readFileSync } from 'node:fs';
import express from 'express';
import { http } from '@google-cloud/functions-framework';
import { parse } from 'csv-parse/sync';
import standardFormidable from 'formidable';
const formidable: typeof standardFormidable = require('formidable-serverless');
import Joi from 'joi';
import dayjs from 'dayjs';

import { load } from './bigquery/bigquery.service';

const app = express();

app.post('/upload', (req, res) => {
    const form = new formidable.IncomingForm();

    new Promise<Record<string, any>[]>((resolve, reject) => {
        form.parse(req, (err, fields, files) => {
            if (err) {
                reject(err);
            }

            // @ts-expect-error
            const data: Record<string, any>[] = parse(readFileSync(files['csv-file'].path), {
                columns: true,
                skip_empty_lines: true,
            });

            resolve(data);
        });
    })
        .then((data) => {
            const timestampSchema = Joi.string()
                .empty('')
                .custom((value: string) => {
                    return value ? dayjs(value).format('YYYY-MM-DDTHH:mm:ss') : null;
                });

            const schema = Joi.object({
                associated_comapny_ids: Joi.string().empty('').default(null),
                associated_company: Joi.string().empty('').default(null),
                campaign: Joi.string().empty('').default(null),
                contact_owner: Joi.string().empty('').default(null),
                create_date: timestampSchema,
                email: Joi.string().empty('').default(null),
                first_name: Joi.string().empty('').default(null),
                first_page_seen: Joi.string().empty('').default(null),
                gclid: Joi.string().empty('').default(null),
                ip_timezone: Joi.string().empty('').default(null),
                last_activity_date: timestampSchema,
                last_name: Joi.string().empty('').default(null),
                lead_status: Joi.string().empty('').default(null),
                location: Joi.string().empty('').default(null),
                original_source: Joi.string().empty('').default(null),
                phone_number: Joi.string().empty('').default(null),
                primary_associated_company_id: Joi.string().empty('').default(null),
                record_id: Joi.number(),
                timezone: Joi.string().empty('').default(null),
                utm_campaign: Joi.string().empty('').default(null),
                utm_content: Joi.string().empty('').default(null),
                utm_source: Joi.string().empty('').default(null),
            })
                .rename('Record ID', 'record_id')
                .rename('First Name', 'first_name')
                .rename('Last Name', 'last_name')
                .rename('Email', 'email')
                .rename('Phone Number', 'phone_number')
                .rename('Contact owner', 'contact_owner')
                .rename('Primary Associated Company ID', 'primary_associated_company_id')
                .rename('Last Activity Date', 'last_activity_date')
                .rename('Lead Status', 'lead_status')
                .rename('Create Date', 'create_date')
                .rename('Campaign', 'campaign')
                .rename('Location', 'location')
                .rename('Time Zone', 'timezone')
                .rename('IP Timezone', 'ip_timezone')
                .rename('Associated Company', 'associated_company')
                .rename('Original Source', 'original_source')
                .rename('First Page Seen', 'first_page_seen')
                .rename('Associated Company IDs', 'associated_comapny_ids');

            return data.map((row) => Joi.attempt(row, schema));
        })
        .then((data) => {
            const schema = [
                { name: 'associated_comapny_ids', type: 'STRING' },
                { name: 'associated_company', type: 'STRING' },
                { name: 'campaign', type: 'STRING' },
                { name: 'contact_owner', type: 'STRING' },
                { name: 'create_date', type: 'TIMESTAMP' },
                { name: 'email', type: 'STRING' },
                { name: 'first_name', type: 'STRING' },
                { name: 'first_page_seen', type: 'STRING' },
                { name: 'gclid', type: 'STRING' },
                { name: 'ip_timezone', type: 'STRING' },
                { name: 'last_activity_date', type: 'TIMESTAMP' },
                { name: 'last_name', type: 'STRING' },
                { name: 'lead_status', type: 'STRING' },
                { name: 'location', type: 'STRING' },
                { name: 'original_source', type: 'STRING' },
                { name: 'phone_number', type: 'STRING' },
                { name: 'primary_associated_company_id', type: 'STRING' },
                { name: 'record_id', type: 'INT64' },
                { name: 'timezone', type: 'STRING' },
                { name: 'utm_campaign', type: 'STRING' },
                { name: 'utm_content', type: 'STRING' },
                { name: 'utm_source', type: 'STRING' },
            ];

            return load(data, { table: 'Contacts', schema });
        })
        .then((result) => res.status(200).json({ result }))
        .catch((error) => res.status(500).json({ error }));
});

app.use('/', (req, res) => {
    res.sendFile(`index.html`, { root: './' });
});

http('main', app);
