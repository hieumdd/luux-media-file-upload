import { readFileSync } from 'node:fs';
import { parse } from 'csv-parse/sync';
import express from 'express';
import dayjs from 'dayjs';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import utc from 'dayjs/plugin/utc';
import { http } from '@google-cloud/functions-framework';
import Joi from 'joi';
import standardFormidable from 'formidable';
const formidable: typeof standardFormidable = require('formidable-serverless');

import { load } from './bigquery/bigquery.service';

dayjs.extend(customParseFormat);
dayjs.extend(utc);

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
                .empty('(No value)')
                .empty('')
                .custom((value: string) => {
                    const dt = dayjs.utc(value, 'DD/MM/YYYY HH:mm');
                    return dt.isValid() ? dt.format('YYYY-MM-DDTHH:mm:ss') : null;
                });

            const stringSchema = Joi.string().empty('(No value)').empty('').default(null);

            const schema = Joi.object({
                create_date: timestampSchema,
                contact_id: Joi.number().unsafe(),
                gclid: stringSchema,
                ip_timezone: stringSchema,
                campaign: stringSchema,
                lead_status: stringSchema,
                adgroup_name: stringSchema,
                utm_campaign: stringSchema,
                utm_content: stringSchema,
                utm_source: stringSchema,
            })
                .rename('Campaign', 'campaign')
                .rename('Create Date', 'create_date')
                .rename('IP Timezone', 'ip_timezone')
                .rename('Lead Status', 'lead_status')
                .rename('Contact ID', 'contact_id');

            return data.map((row) => Joi.attempt(row, schema, { stripUnknown: true }));
        })
        .then((data) => {
            const schema = [
                { name: 'create_date', type: 'TIMESTAMP' },
                { name: 'contact_id', type: 'INT64' },
                { name: 'gclid', type: 'STRING' },
                { name: 'ip_timezone', type: 'STRING' },
                { name: 'campaign', type: 'STRING' },
                { name: 'lead_status', type: 'STRING' },
                { name: 'adgroup_name', type: 'STRING' },
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
